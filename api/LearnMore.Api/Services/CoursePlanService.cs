using LearnMore.Api.Data;
using LearnMore.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LearnMore.Api.Services;

public record CourseArtifactDto(int Id, string Type, string Title, string? Url, DateTime CreatedOn);
public record CourseSessionDto(int Id, string Date, int Minutes, string Note);

public record ActiveCourseDto(
    int Id, int Order, string Title, string Instructor, string Url,
    int EstimatedHours, double HoursLogged, int RequiredArtifacts, int ArtifactCount,
    int Streak, bool CanComplete, string? BlockedReason,
    List<CourseArtifactDto> Artifacts, List<CourseSessionDto> RecentSessions);

/// <summary>Pause gate shown after a checkpoint course; cleared by an explicit continue.</summary>
public record CheckpointDto(int CompletedOrder, string CompletedTitle, int NextOrder, string NextTitle, string Message);

/// <summary>state: active | checkpoint | finished</summary>
public record CourseNowDto(string State, ActiveCourseDto? Course, CheckpointDto? Checkpoint);

public record CoursePlanRowDto(
    int Id, int Order, string Title, string Instructor, string Url, int EstimatedHours,
    string Status, double HoursLogged, int ArtifactCount, int RequiredArtifacts,
    bool IsCheckpoint, DateTime? StartedOn, DateTime? CompletedOn);

public record LogSessionDto(int Minutes, string? Note);
public record AddArtifactDto(string Type, string Title, string? Url);

/// <summary>
/// The fixed course ladder. Domain rules live here, not in the UI:
/// exactly one Active course, sessions only against it, completion blocked until the
/// required artifacts exist, and a checkpoint course does not auto-unlock its successor.
/// </summary>
public class CoursePlanService(AppDbContext db)
{
    /// <summary>A day counts toward the streak at 10 minutes — consistency, not volume.</summary>
    public const int StreakMinutes = 10;

    public const string CheckpointMessage =
        "Checkpoint. You've changed since you started. Before continuing, decide whether courses 5–7 " +
        "are still what you need, or whether something else matters more now.";

    private static DateOnly Today => DateOnly.FromDateTime(DateTime.Now);

    private static double Hours(IEnumerable<StudySession> sessions) =>
        Math.Round(sessions.Sum(s => s.Minutes) / 60.0, 1);

    public async Task<CourseNowDto> GetNowAsync()
    {
        var active = await db.PlanCourses
            .Include(c => c.Sessions)
            .Include(c => c.Artifacts)
            .FirstOrDefaultAsync(c => c.Status == CourseStatus.Active);

        if (active is not null)
            return new CourseNowDto("active", ToActiveDto(active, await StreakAsync()), null);

        // No active course: either a checkpoint is waiting to be acknowledged, or the plan is done.
        var lastDone = await db.PlanCourses
            .Where(c => c.Status == CourseStatus.Done)
            .OrderByDescending(c => c.Order)
            .FirstOrDefaultAsync();

        if (lastDone is { IsCheckpoint: true })
        {
            var next = await NextAfterAsync(lastDone.Order);
            if (next is not null)
                return new CourseNowDto("checkpoint", null,
                    new CheckpointDto(lastDone.Order, lastDone.Title, next.Order, next.Title, CheckpointMessage));
        }

        return new CourseNowDto("finished", null, null);
    }

    public async Task<List<CoursePlanRowDto>> GetPlanAsync() =>
        (await db.PlanCourses
            .Include(c => c.Sessions)
            .Include(c => c.Artifacts)
            .OrderBy(c => c.Order)
            .ToListAsync())
        .Select(c => new CoursePlanRowDto(
            c.Id, c.Order, c.Title, c.Instructor, c.Url, c.EstimatedHours,
            c.Status.ToString().ToLowerInvariant(), Hours(c.Sessions), c.Artifacts.Count,
            c.RequiredArtifacts, c.IsCheckpoint, c.StartedOn, c.CompletedOn))
        .ToList();

    /// <summary>Sessions can only be logged against the currently active course.</summary>
    public async Task<CourseNowDto?> LogSessionAsync(LogSessionDto dto)
    {
        var active = await db.PlanCourses.FirstOrDefaultAsync(c => c.Status == CourseStatus.Active);
        if (active is null) return null;

        var minutes = Math.Clamp(dto.Minutes, 1, 24 * 60);
        db.StudySessions.Add(new StudySession
        {
            CourseId = active.Id,
            Date = Today,
            Minutes = minutes,
            Note = (dto.Note ?? "").Trim()
        });
        await db.SaveChangesAsync();
        return await GetNowAsync();
    }

    public async Task<CourseNowDto?> AddArtifactAsync(AddArtifactDto dto)
    {
        var active = await db.PlanCourses.FirstOrDefaultAsync(c => c.Status == CourseStatus.Active);
        if (active is null || string.IsNullOrWhiteSpace(dto.Title)) return null;

        var type = Enum.TryParse<ArtifactType>(dto.Type, ignoreCase: true, out var t) ? t : ArtifactType.Other;
        var url = string.IsNullOrWhiteSpace(dto.Url) ? null : dto.Url.Trim();

        db.Artifacts.Add(new Artifact
        {
            CourseId = active.Id,
            Type = type,
            Title = dto.Title.Trim(),
            Url = url,
            CreatedOn = DateTime.Now
        });
        await db.SaveChangesAsync();
        return await GetNowAsync();
    }

    public async Task<bool> DeleteArtifactAsync(int id)
    {
        var artifact = await db.Artifacts.Include(a => a.Course).FirstOrDefaultAsync(a => a.Id == id);
        if (artifact is null || artifact.Course.Status != CourseStatus.Active) return false;
        db.Artifacts.Remove(artifact);
        await db.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// Completes the active course. Blocked — with no override — until it has its required
    /// artifacts. A checkpoint course stops here; the next one is unlocked by ContinueAsync.
    /// </summary>
    public async Task<(bool Ok, string? Error, CourseNowDto? Now)> CompleteActiveAsync()
    {
        var active = await db.PlanCourses
            .Include(c => c.Artifacts)
            .FirstOrDefaultAsync(c => c.Status == CourseStatus.Active);
        if (active is null) return (false, "No active course.", null);

        var missing = active.RequiredArtifacts - active.Artifacts.Count;
        if (missing > 0)
            return (false, $"Log {missing} more artifact(s) first", null);

        active.Status = CourseStatus.Done;
        active.CompletedOn = DateTime.Now;

        if (!active.IsCheckpoint)
        {
            var next = await NextAfterAsync(active.Order);
            if (next is not null) Activate(next);
        }

        await db.SaveChangesAsync();
        return (true, null, await GetNowAsync());
    }

    /// <summary>Explicit acknowledgement of a checkpoint — the only way past it.</summary>
    public async Task<CourseNowDto?> ContinueAfterCheckpointAsync()
    {
        if (await db.PlanCourses.AnyAsync(c => c.Status == CourseStatus.Active)) return null;

        var lastDone = await db.PlanCourses
            .Where(c => c.Status == CourseStatus.Done)
            .OrderByDescending(c => c.Order)
            .FirstOrDefaultAsync();
        if (lastDone is not { IsCheckpoint: true }) return null;

        var next = await NextAfterAsync(lastDone.Order);
        if (next is null) return null;

        Activate(next);
        await db.SaveChangesAsync();
        return await GetNowAsync();
    }

    private static void Activate(PlanCourse course)
    {
        course.Status = CourseStatus.Active;
        course.StartedOn ??= DateTime.Now;
    }

    private Task<PlanCourse?> NextAfterAsync(int order) =>
        db.PlanCourses.Where(c => c.Order > order).OrderBy(c => c.Order).FirstOrDefaultAsync();

    /// <summary>Consecutive days (ending today, or yesterday if today isn't logged yet)
    /// with at least one session of <see cref="StreakMinutes"/> minutes or more.</summary>
    private async Task<int> StreakAsync()
    {
        var days = (await db.StudySessions
                .Where(s => s.Minutes >= StreakMinutes)
                .Select(s => s.Date)
                .Distinct()
                .ToListAsync())
            .ToHashSet();

        var cursor = days.Contains(Today) ? Today : Today.AddDays(-1);
        var streak = 0;
        while (days.Contains(cursor)) { streak++; cursor = cursor.AddDays(-1); }
        return streak;
    }

    private static ActiveCourseDto ToActiveDto(PlanCourse c, int streak)
    {
        var missing = c.RequiredArtifacts - c.Artifacts.Count;
        return new ActiveCourseDto(
            c.Id, c.Order, c.Title, c.Instructor, c.Url, c.EstimatedHours,
            Hours(c.Sessions), c.RequiredArtifacts, c.Artifacts.Count, streak,
            missing <= 0, missing > 0 ? $"Log {missing} more artifact(s) first" : null,
            c.Artifacts.OrderByDescending(a => a.CreatedOn).ThenByDescending(a => a.Id)
                .Select(a => new CourseArtifactDto(a.Id, a.Type.ToString(), a.Title, a.Url, a.CreatedOn))
                .ToList(),
            c.Sessions.OrderByDescending(s => s.Date).ThenByDescending(s => s.Id).Take(5)
                .Select(s => new CourseSessionDto(s.Id, s.Date.ToString("yyyy-MM-dd"), s.Minutes, s.Note))
                .ToList());
    }
}
