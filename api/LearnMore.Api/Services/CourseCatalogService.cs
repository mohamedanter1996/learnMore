using System.Text.Json;
using LearnMore.Api.Data;

namespace LearnMore.Api.Services;

public record Course(string Title, string Provider, string Url, int Level, bool IsPaid, string Lang);

public class CourseCatalogFile
{
    public List<CourseCatalogTopic> Topics { get; set; } = [];
}

public class CourseCatalogTopic
{
    public string Topic { get; set; } = "";
    public List<CourseCatalogEntry> Courses { get; set; } = [];
}

public class CourseCatalogEntry
{
    public string Title { get; set; } = "";
    public string Provider { get; set; } = "";
    public string Url { get; set; } = "";
    public int Level { get; set; } = 1;   // 1 Junior, 2 Mid, 3 Senior
    public bool IsPaid { get; set; }
    public string Lang { get; set; } = "en"; // en | ar
}

/// <summary>
/// Loads seed/courses.json once and serves per-topic, per-level recommendations.
/// No database table — the catalog is reference data shipped with the app.
/// </summary>
public class CourseCatalogService(IConfiguration config, ILogger<CourseCatalogService> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };
    private readonly Lazy<Dictionary<string, List<Course>>> _catalog = new(() => Load(config, logger));

    private static Dictionary<string, List<Course>> Load(IConfiguration config, ILogger logger)
    {
        var seedDir = SeedService.ResolveSeedDirectory(config);
        var file = seedDir is null ? null : Path.Combine(seedDir, "courses.json");
        if (file is null || !File.Exists(file))
        {
            logger.LogWarning("courses.json not found; course recommendations disabled.");
            return [];
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<CourseCatalogFile>(File.ReadAllText(file), JsonOptions);
            return (parsed?.Topics ?? []).ToDictionary(
                t => t.Topic,
                t => t.Courses.Select(c => new Course(c.Title, c.Provider, c.Url,
                    Math.Clamp(c.Level, 1, 3), c.IsPaid, c.Lang)).ToList());
        }
        catch (JsonException ex)
        {
            logger.LogError(ex, "Invalid courses.json; course recommendations disabled.");
            return [];
        }
    }

    public List<Course> GetCourses(string topicName, int? level = null)
    {
        if (!_catalog.Value.TryGetValue(topicName, out var courses)) return [];
        return level is null ? courses : courses.Where(c => c.Level == level).ToList();
    }
}
