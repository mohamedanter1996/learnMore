using System.Text.Json;
using LearnMore.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LearnMore.Api.Data;

public class SeedFile
{
    public string Topic { get; set; } = "";
    public string Color { get; set; } = "#888888";
    public string Icon { get; set; } = "";
    public List<SeedItem> Items { get; set; } = [];
}

public class SeedItem
{
    public string Title { get; set; } = "";
    public int Difficulty { get; set; } = 1;
    public int EstimatedMinutes { get; set; } = 15;
    public string BodyMarkdown { get; set; } = "";
    public string PracticeTask { get; set; } = "";
    public List<string> ExternalLinks { get; set; } = [];
    public List<SeedQuiz> Quiz { get; set; } = [];
}

public class SeedQuiz
{
    public string Question { get; set; } = "";
    public List<string> Options { get; set; } = [];
    public int CorrectIndex { get; set; }
    public string Explanation { get; set; } = "";
}

public class ArabicSeedFile
{
    public string Topic { get; set; } = "";
    public List<ArabicSeedItem> Items { get; set; } = [];
}

public class ArabicSeedItem
{
    public string Title { get; set; } = "";
    public string ExplanationArabic { get; set; } = "";
}

public class InterviewSeedFile
{
    public string Topic { get; set; } = "";
    public List<InterviewSeedItem> Items { get; set; } = [];
}

public class InterviewSeedItem
{
    public int Level { get; set; } = 1;
    public string Question { get; set; } = "";
    public List<string> Options { get; set; } = [];
    public int CorrectIndex { get; set; }
    public string Explanation { get; set; } = "";
    public string? RelatedLessonTitle { get; set; }
}

public class SeedService(AppDbContext db, IConfiguration config, ILogger<SeedService> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task SeedAsync()
    {
        await SeedCoursePlanAsync();

        var seedDir = ResolveSeedDirectory();
        if (seedDir is null)
        {
            logger.LogWarning("Seed directory not found; skipping content seed.");
            return;
        }

        foreach (var file in Directory.EnumerateFiles(seedDir, "*.json").OrderBy(f => f))
        {
            SeedFile? seed;
            try
            {
                seed = JsonSerializer.Deserialize<SeedFile>(await File.ReadAllTextAsync(file), JsonOptions);
            }
            catch (JsonException ex)
            {
                logger.LogError(ex, "Invalid seed file {File}; skipping.", file);
                continue;
            }
            if (seed is null || string.IsNullOrWhiteSpace(seed.Topic)) continue;

            var topic = await db.Topics.Include(t => t.Items)
                .FirstOrDefaultAsync(t => t.Name == seed.Topic);
            if (topic is null)
            {
                topic = new Topic { Name = seed.Topic, Color = seed.Color, Icon = seed.Icon };
                db.Topics.Add(topic);
            }

            var existingTitles = topic.Items.Select(i => i.Title).ToHashSet();
            var sortOrder = topic.Items.Count == 0 ? 0 : topic.Items.Max(i => i.SortOrder) + 1;

            foreach (var item in seed.Items)
            {
                if (existingTitles.Contains(item.Title)) continue;
                topic.Items.Add(new LearningItem
                {
                    Title = item.Title,
                    Difficulty = Math.Clamp(item.Difficulty, 1, 3),
                    EstimatedMinutes = item.EstimatedMinutes,
                    BodyMarkdown = item.BodyMarkdown,
                    PracticeTask = item.PracticeTask,
                    ExternalLinksJson = JsonSerializer.Serialize(item.ExternalLinks),
                    SortOrder = sortOrder++,
                    Quiz = item.Quiz.Select(q => new QuizQuestion
                    {
                        Question = q.Question,
                        OptionsJson = JsonSerializer.Serialize(q.Options),
                        CorrectIndex = q.CorrectIndex,
                        Explanation = q.Explanation
                    }).ToList()
                });
            }
        }

        if (!await db.UserStats.AnyAsync()) db.UserStats.Add(new UserStats());
        if (!await db.AppSettings.AnyAsync()) db.AppSettings.Add(new AppSettings());

        var added = await db.SaveChangesAsync();
        if (added > 0) logger.LogInformation("Seeded {Count} new records from {Dir}.", added, seedDir);

        await SeedArabicAsync(seedDir);
        await SeedInterviewAsync(seedDir);
    }

    /// <summary>
    /// The fixed course ladder. It lives in code on purpose — the plan is not editable from
    /// the UI, so changing it is a deliberate code change. Seeded once, then left alone so
    /// progress survives updates.
    /// </summary>
    private async Task SeedCoursePlanAsync()
    {
        if (await db.PlanCourses.AnyAsync()) return;

        var courses = new (string Title, string Instructor, int Hours, string Url, bool Checkpoint)[]
        {
            ("Algorithms and Data Structures in C#", "Engineer Spock", 10,
                "https://www.udemy.com/course/algorithms-data-structures-csharp/", false),
            ("Design Patterns in C# and .NET — SOLID section only", "Dmitri Nesteruk", 1,
                "https://www.udemy.com/course/design-patterns-csharp-dotnet/", false),
            ("T-SQL Execution Plans, Indexes, Transactions", "Vikas Munjal", 7,
                "https://www.udemy.com/course/understanding-execution-plans-indexes-sql-server/", false),
            (".NET 8 Microservices: DDD, CQRS, Vertical/Clean Architecture", "Mehmet Ozkaya", 15,
                "https://www.udemy.com/course/microservices-architecture-and-implementation-on-dotnet/", true),
            ("Software Architecture and Design of Modern Large Scale Systems", "Michael Pogrebinsky", 18,
                "https://www.udemy.com/course/software-architecture-design-of-modern-large-scale-systems/", false),
            ("The Complete Microservices and Event-Driven Architecture", "Michael Pogrebinsky", 15,
                "https://www.udemy.com/course/the-complete-microservices-event-driven-architecture/", false),
            ("The Complete Cloud Computing Software Architecture Patterns", "Michael Pogrebinsky", 12,
                "https://www.udemy.com/course/the-complete-cloud-computing-software-architecture-patterns/", false)
        };

        var order = 1;
        foreach (var c in courses)
        {
            db.PlanCourses.Add(new PlanCourse
            {
                Order = order,
                Title = c.Title,
                Instructor = c.Instructor,
                Url = c.Url,
                EstimatedHours = c.Hours,
                IsCheckpoint = c.Checkpoint,
                // Course 1 is the one you open today; the rest unlock by finishing the previous one.
                Status = order == 1 ? CourseStatus.Active : CourseStatus.Locked,
                StartedOn = order == 1 ? DateTime.Now : null
            });
            order++;
        }

        await db.SaveChangesAsync();
        logger.LogInformation("Seeded course plan ({Count} courses).", courses.Length);
    }

    /// <summary>
    /// Seeds interview questions from seed/interview/*.json, matched by topic name.
    /// Idempotent: new question texts are added, existing ones untouched.
    /// </summary>
    private async Task SeedInterviewAsync(string seedDir)
    {
        var dir = Path.Combine(seedDir, "interview");
        if (!Directory.Exists(dir)) return;

        var added = 0;
        foreach (var file in Directory.EnumerateFiles(dir, "*.json").OrderBy(f => f))
        {
            InterviewSeedFile? seed;
            try
            {
                seed = JsonSerializer.Deserialize<InterviewSeedFile>(await File.ReadAllTextAsync(file), JsonOptions);
            }
            catch (JsonException ex)
            {
                logger.LogError(ex, "Invalid interview seed file {File}; skipping.", file);
                continue;
            }
            if (seed is null || string.IsNullOrWhiteSpace(seed.Topic)) continue;

            var topic = await db.Topics.FirstOrDefaultAsync(t => t.Name == seed.Topic);
            if (topic is null)
            {
                logger.LogWarning("Interview seed: unknown topic '{Topic}'.", seed.Topic);
                continue;
            }

            var existing = (await db.InterviewQuestions
                .Where(q => q.TopicId == topic.Id)
                .Select(q => q.Question)
                .ToListAsync()).ToHashSet();

            foreach (var item in seed.Items)
            {
                if (existing.Contains(item.Question)) continue;
                db.InterviewQuestions.Add(new InterviewQuestion
                {
                    TopicId = topic.Id,
                    Level = Math.Clamp(item.Level, 1, 3),
                    Question = item.Question,
                    OptionsJson = JsonSerializer.Serialize(item.Options),
                    CorrectIndex = item.CorrectIndex,
                    Explanation = item.Explanation,
                    RelatedLessonTitle = item.RelatedLessonTitle
                });
                added++;
            }
        }

        if (added > 0)
        {
            await db.SaveChangesAsync();
            logger.LogInformation("Seeded {Count} interview questions.", added);
        }
    }

    /// <summary>
    /// Merges Egyptian-Arabic explanations from seed/ar/*.json into existing items,
    /// matched by topic name + item title. Re-runnable: updates when the text changed.
    /// </summary>
    private async Task SeedArabicAsync(string seedDir)
    {
        var arDir = Path.Combine(seedDir, "ar");
        if (!Directory.Exists(arDir)) return;

        var updated = 0;
        foreach (var file in Directory.EnumerateFiles(arDir, "*.json").OrderBy(f => f))
        {
            ArabicSeedFile? seed;
            try
            {
                seed = JsonSerializer.Deserialize<ArabicSeedFile>(await File.ReadAllTextAsync(file), JsonOptions);
            }
            catch (JsonException ex)
            {
                logger.LogError(ex, "Invalid Arabic seed file {File}; skipping.", file);
                continue;
            }
            if (seed is null || string.IsNullOrWhiteSpace(seed.Topic)) continue;

            var items = await db.LearningItems
                .Where(i => i.Topic.Name == seed.Topic)
                .ToDictionaryAsync(i => i.Title);

            foreach (var ar in seed.Items)
            {
                if (string.IsNullOrWhiteSpace(ar.ExplanationArabic)) continue;
                if (!items.TryGetValue(ar.Title, out var item))
                {
                    logger.LogWarning("Arabic seed: no item titled '{Title}' in topic '{Topic}'.", ar.Title, seed.Topic);
                    continue;
                }
                if (item.ExplanationArabic != ar.ExplanationArabic)
                {
                    item.ExplanationArabic = ar.ExplanationArabic;
                    updated++;
                }
            }
        }

        if (updated > 0)
        {
            await db.SaveChangesAsync();
            logger.LogInformation("Applied {Count} Arabic explanations.", updated);
        }
    }

    private string? ResolveSeedDirectory() => ResolveSeedDirectory(config);

    public static string? ResolveSeedDirectory(IConfiguration config)
    {
        // Explicit override (set by Electron in production, points at resources/seed)
        var configured = config["SeedDirectory"];
        if (!string.IsNullOrWhiteSpace(configured) && Directory.Exists(configured))
            return Path.GetFullPath(configured);

        // Dev fallback: walk up from the app base dir looking for a "seed" folder
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, "seed");
            if (Directory.Exists(candidate)) return candidate;
            dir = dir.Parent;
        }
        return null;
    }
}
