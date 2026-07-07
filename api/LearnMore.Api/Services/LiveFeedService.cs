using System.Collections.Concurrent;
using System.ServiceModel.Syndication;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml;

namespace LearnMore.Api.Services;

public record LivePost(string Title, string Published, string Summary, string Url, string Source);

/// <summary>
/// Fetches official-blog RSS/Atom feeds, groups the latest posts by technology,
/// caches to disk so the feed still works offline, and serves them to the
/// What's New endpoint alongside the curated seed content.
/// </summary>
public class LiveFeedService
{
    private const int PerBucket = 5;

    // One RSS/Atom source and which technology buckets its posts belong to.
    // A post joins a bucket only if the bucket's keyword filter matches
    // (null filter = include everything from this feed).
    private record FeedSource(string Url, string Source, (string Tech, string[]? Keywords)[] Buckets);

    private static readonly FeedSource[] Sources =
    [
        // The .NET blog is the primary source for .NET, C#, and EF Core news, so all
        // three buckets draw from it (unfiltered — recent titles rarely contain the
        // literal "C#"/"EF" keywords, and keyword-filtering left those tabs empty).
        new("https://devblogs.microsoft.com/dotnet/feed/", ".NET blog",
        [
            (".NET", null),
            ("C#", null),
            ("Entity Framework Core", null)
        ]),
        new("https://blog.angular.dev/feed", "Angular blog", [("Angular", null)]),
        new("https://devblogs.microsoft.com/typescript/feed/", "TypeScript blog", [("TypeScript", null)]),
        new("https://devblogs.microsoft.com/azure-sql/feed/", "Azure SQL blog", [("SQL Server", null)]),
        new("https://web.dev/feed.xml", "web.dev", [("Web Platform & CSS", null)])
    ];

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<LiveFeedService> _logger;
    private readonly string _cachePath;
    private volatile Dictionary<string, List<LivePost>> _byTech = new();

    public LiveFeedService(IHttpClientFactory httpFactory, ILogger<LiveFeedService> logger)
    {
        _httpFactory = httpFactory;
        _logger = logger;

        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LearnMore");
        Directory.CreateDirectory(dir);
        _cachePath = Path.Combine(dir, "feed-cache.json");

        LoadCache();
    }

    public List<LivePost> GetLivePosts(string techName) =>
        _byTech.TryGetValue(techName, out var posts) ? posts : [];

    private void LoadCache()
    {
        try
        {
            if (File.Exists(_cachePath))
            {
                var cached = JsonSerializer.Deserialize<Dictionary<string, List<LivePost>>>(
                    File.ReadAllText(_cachePath), JsonOptions);
                if (cached is not null) _byTech = cached;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not load live-feed cache.");
        }
    }

    private void SaveCache()
    {
        try
        {
            File.WriteAllText(_cachePath, JsonSerializer.Serialize(_byTech));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not save live-feed cache.");
        }
    }

    /// <summary>
    /// Fetches every source in parallel (one failure never breaks the others),
    /// rebuilds the per-technology buckets, and persists them. Keeps the previous
    /// (cached) data for any source that failed this round.
    /// </summary>
    public async Task RefreshAsync(CancellationToken ct = default)
    {
        var buckets = new ConcurrentDictionary<string, List<LivePost>>();
        var anySuccess = false;

        await Parallel.ForEachAsync(Sources, ct, async (src, token) =>
        {
            try
            {
                var posts = await FetchFeedAsync(src, token);
                anySuccess = true;
                foreach (var (tech, keywords) in src.Buckets)
                {
                    var filtered = keywords is null
                        ? posts
                        : posts.Where(p => keywords.Any(k =>
                            p.Title.Contains(k, StringComparison.OrdinalIgnoreCase))).ToList();
                    if (filtered.Count > 0)
                        buckets[tech] = filtered.Take(PerBucket).ToList();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Live feed fetch failed for {Source}.", src.Source);
            }
        });

        if (!anySuccess)
        {
            _logger.LogInformation("No live feeds reachable; keeping cached content.");
            return;
        }

        // Merge: keep cached buckets for techs whose source failed this round.
        var merged = new Dictionary<string, List<LivePost>>(_byTech);
        foreach (var (tech, posts) in buckets) merged[tech] = posts;
        _byTech = merged;

        SaveCache();
        _logger.LogInformation("Live feeds refreshed: {Count} technology buckets.", buckets.Count);
    }

    private async Task<List<LivePost>> FetchFeedAsync(FeedSource src, CancellationToken ct)
    {
        var client = _httpFactory.CreateClient("feeds");
        client.Timeout = TimeSpan.FromSeconds(10);
        client.DefaultRequestHeaders.UserAgent.ParseAdd("LearnMore/1.0 (+https://github.com/mohamedanter1996/learnMore)");

        await using var stream = await client.GetStreamAsync(src.Url, ct);
        using var reader = XmlReader.Create(stream, new XmlReaderSettings { Async = false, DtdProcessing = DtdProcessing.Ignore });
        var feed = SyndicationFeed.Load(reader);
        if (feed is null) return [];

        return feed.Items
            .OrderByDescending(i => i.PublishDate)
            .Take(PerBucket * 2) // headroom before keyword filtering
            .Select(i => new LivePost(
                CleanText(i.Title?.Text ?? "(untitled)"),
                i.PublishDate == default ? "" : i.PublishDate.UtcDateTime.ToString("yyyy-MM-dd"),
                Truncate(CleanText(i.Summary?.Text ?? ""), 220),
                i.Links.FirstOrDefault()?.Uri?.ToString() ?? src.Url,
                src.Source))
            .ToList();
    }

    // Strip HTML tags + collapse whitespace so summaries render safely as plain text.
    private static string CleanText(string html)
    {
        var noTags = Regex.Replace(html, "<.*?>", " ");
        var decoded = System.Net.WebUtility.HtmlDecode(noTags);
        return Regex.Replace(decoded, @"\s+", " ").Trim();
    }

    private static string Truncate(string s, int max) =>
        s.Length <= max ? s : s[..max].TrimEnd() + "…";
}
