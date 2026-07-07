using System.Text.Json;
using LearnMore.Api.Data;

namespace LearnMore.Api.Services;

public record WhatsNewEntry(string Version, string Date, string Title, string BodyMarkdown, string? Url);
public record WhatsNewTech(string Technology, string Icon, string Color, List<WhatsNewEntry> Entries);

// Sent to the client: curated entries + live blog posts for the same technology.
public record WhatsNewTechResponse(string Technology, string Icon, string Color,
    List<WhatsNewEntry> Entries, List<LivePost> LivePosts);

public class WhatsNewFile
{
    public List<WhatsNewTechDto> Technologies { get; set; } = [];
}

public class WhatsNewTechDto
{
    public string Technology { get; set; } = "";
    public string Icon { get; set; } = "";
    public string Color { get; set; } = "#888888";
    public List<WhatsNewEntryDto> Entries { get; set; } = [];
}

public class WhatsNewEntryDto
{
    public string Version { get; set; } = "";
    public string Date { get; set; } = "";
    public string Title { get; set; } = "";
    public string BodyMarkdown { get; set; } = "";
    public string? Url { get; set; }
}

/// <summary>
/// Loads seed/whatsnew.json once — a curated per-technology "what's new" feed.
/// Reference content shipped with the app, refreshed each release (no DB table).
/// </summary>
public class WhatsNewService(IConfiguration config, ILogger<WhatsNewService> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };
    private readonly Lazy<List<WhatsNewTech>> _feed = new(() => Load(config, logger));

    private static List<WhatsNewTech> Load(IConfiguration config, ILogger logger)
    {
        var seedDir = SeedService.ResolveSeedDirectory(config);
        var file = seedDir is null ? null : Path.Combine(seedDir, "whatsnew.json");
        if (file is null || !File.Exists(file))
        {
            logger.LogWarning("whatsnew.json not found; tech feed disabled.");
            return [];
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<WhatsNewFile>(File.ReadAllText(file), JsonOptions);
            return (parsed?.Technologies ?? []).Select(t => new WhatsNewTech(
                t.Technology, t.Icon, t.Color,
                t.Entries.Select(e => new WhatsNewEntry(e.Version, e.Date, e.Title, e.BodyMarkdown, e.Url))
                    .ToList())).ToList();
        }
        catch (JsonException ex)
        {
            logger.LogError(ex, "Invalid whatsnew.json; tech feed disabled.");
            return [];
        }
    }

    public List<WhatsNewTech> GetFeed() => _feed.Value;
}
