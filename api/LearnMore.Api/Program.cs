using LearnMore.Api;
using LearnMore.Api.Data;
using LearnMore.Api.Models;
using LearnMore.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls("http://localhost:5199");

builder.Services.AddDbContext<AppDbContext>(o =>
    o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddScoped<SeedService>();
builder.Services.AddScoped<AssignmentService>();
builder.Services.AddScoped<AssessmentService>();
builder.Services.AddSingleton<CourseCatalogService>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins("http://localhost:4200").AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

app.UseCors();

// In production the Angular build is copied into wwwroot and served by the API,
// so the Electron shell loads everything from one origin.
app.UseDefaultFiles();
app.UseStaticFiles();

// Create/upgrade schema and seed content on startup.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await scope.ServiceProvider.GetRequiredService<SeedService>().SeedAsync();
}

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

app.MapGet("/api/today", async (AssignmentService svc) =>
    (await svc.GetOrCreateTodayAsync()).ToTodayDto());

app.MapPost("/api/today/complete", async (CompleteRequestDto req, AssignmentService svc) =>
{
    var answers = req.Answers.ToDictionary(a => a.QuestionId, a => a.SelectedIndex);
    var result = await svc.CompleteTodayAsync(answers);
    return Results.Ok(result);
});

app.MapGet("/api/topics", async (AppDbContext db) =>
    await db.Topics
        .OrderBy(t => t.Id)
        .Select(t => new TopicSummaryDto(
            t.Id, t.Name, t.Color, t.Icon,
            t.Items.Count,
            t.Items.Count(i => db.DailyAssignments.Any(a =>
                a.LearningItemId == i.Id && a.Status == AssignmentStatus.Completed))))
        .ToListAsync());

app.MapGet("/api/topics/{id:int}/items", async (int id, AppDbContext db) =>
{
    var today = AssignmentService.Today;
    var rows = await db.LearningItems
        .Where(i => i.TopicId == id)
        .OrderBy(i => i.Difficulty).ThenBy(i => i.SortOrder).ThenBy(i => i.Id)
        .Select(i => new TopicItemRowDto(
            i.Id, i.Title, i.Difficulty, i.EstimatedMinutes,
            db.DailyAssignments.Any(a => a.LearningItemId == i.Id && a.Status == AssignmentStatus.Completed)
                ? "completed"
                : db.DailyAssignments.Any(a => a.LearningItemId == i.Id && a.Date == today)
                    ? "today"
                    : "locked"))
        .ToListAsync();
    return Results.Ok(rows);
});

app.MapGet("/api/items/{id:int}", async (int id, AppDbContext db) =>
{
    var item = await db.LearningItems
        .Include(i => i.Topic).Include(i => i.Quiz)
        .FirstOrDefaultAsync(i => i.Id == id);
    if (item is null) return Results.NotFound();

    var today = AssignmentService.Today;
    var completed = await db.DailyAssignments.AnyAsync(a =>
        a.LearningItemId == id && a.Status == AssignmentStatus.Completed);
    var isToday = await db.DailyAssignments.AnyAsync(a =>
        a.LearningItemId == id && a.Date == today);

    if (!completed && !isToday)
        return Results.StatusCode(StatusCodes.Status403Forbidden); // locked until assigned

    return Results.Ok(item.ToItemDto(revealAnswers: completed));
});

app.MapGet("/api/stats", async (AppDbContext db) =>
{
    var stats = await db.UserStats.FirstAsync();
    var totalItems = await db.LearningItems.CountAsync();

    var perTopic = await db.Topics
        .OrderBy(t => t.Id)
        .Select(t => new TopicSummaryDto(
            t.Id, t.Name, t.Color, t.Icon,
            t.Items.Count,
            t.Items.Count(i => db.DailyAssignments.Any(a =>
                a.LearningItemId == i.Id && a.Status == AssignmentStatus.Completed))))
        .ToListAsync();

    var today = AssignmentService.Today;
    var from = today.AddDays(-29);
    var assignments = await db.DailyAssignments
        .Where(a => a.Date >= from && a.Date <= today)
        .ToDictionaryAsync(a => a.Date, a => a.Status);

    var firstDate = await db.DailyAssignments.MinAsync(a => (DateOnly?)a.Date);
    var calendar = Enumerable.Range(0, 30)
        .Select(offset =>
        {
            var d = from.AddDays(offset);
            var status = assignments.TryGetValue(d, out var s)
                ? (s == AssignmentStatus.Completed ? "completed" : d == today ? "pending" : "missed")
                : (firstDate.HasValue && d >= firstDate && d < today ? "missed" : "none");
            return new CalendarDayDto(d, status);
        })
        .ToList();

    return new StatsDto(stats.CurrentStreak, stats.LongestStreak, stats.TotalCompleted,
        totalItems, perTopic, calendar);
});

// ---------------------------------------------------------------- assessments

app.MapGet("/api/assessment", async (AssessmentService svc) =>
    await svc.GetOverviewAsync());

app.MapGet("/api/assessment/{topicId:int}", async (int topicId, AssessmentService svc) =>
{
    var questions = await svc.GetQuestionsAsync(topicId);
    return questions.Count == 0 ? Results.NotFound() : Results.Ok(questions);
});

app.MapPost("/api/assessment/{topicId:int}/submit", async (int topicId, CompleteRequestDto req, AssessmentService svc) =>
{
    var answers = req.Answers.ToDictionary(a => a.QuestionId, a => a.SelectedIndex);
    var result = await svc.SubmitAsync(topicId, answers);
    return result is null ? Results.NotFound() : Results.Ok(result);
});

app.MapGet("/api/assessment/result/{attemptId:int}", async (int attemptId, AssessmentService svc) =>
{
    var result = await svc.GetResultAsync(attemptId);
    return result is null ? Results.NotFound() : Results.Ok(result);
});

app.MapGet("/api/assessment/{topicId:int}/history", async (int topicId, AssessmentService svc) =>
    await svc.GetHistoryAsync(topicId));

app.MapGet("/api/roadmap", async (AssessmentService svc) =>
    await svc.GetRoadmapAsync());

app.MapGet("/api/courses", (int topicId, int? level, AppDbContext db, CourseCatalogService catalog) =>
{
    var topic = db.Topics.Find(topicId);
    return topic is null ? Results.NotFound() : Results.Ok(catalog.GetCourses(topic.Name, level));
});

app.MapGet("/api/settings", async (AppDbContext db) =>
{
    var s = await db.AppSettings.FirstAsync();
    return new SettingsDto(s.ReminderTime, s.ReminderRepeatHours, s.NotificationsEnabled);
});

app.MapPut("/api/settings", async (SettingsDto dto, AppDbContext db) =>
{
    var s = await db.AppSettings.FirstAsync();
    s.ReminderTime = dto.ReminderTime;
    s.ReminderRepeatHours = dto.ReminderRepeatHours;
    s.NotificationsEnabled = dto.NotificationsEnabled;
    await db.SaveChangesAsync();
    return Results.Ok(dto);
});

app.MapFallbackToFile("index.html");

app.Run();
