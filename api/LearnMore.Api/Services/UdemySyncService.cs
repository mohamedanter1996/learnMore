using LearnMore.Api.Data;
using LearnMore.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LearnMore.Api.Services;

/// <summary>One course as the Electron shell read it from Udemy.</summary>
public record UdemyCourseInput(
    long Id, string? Title, string? Url, double? CompletionRatio, int? LectureCount, DateTime? LastAccessed);

/// <summary>
/// A sync push from the shell. <paramref name="Error"/> set means the fetch failed
/// (expired session, offline) — the last known percentages are kept either way.
/// </summary>
public record UdemySyncRequest(string? Account, List<UdemyCourseInput>? Courses, string? Error);

public record UdemyStatusDto(
    bool Connected, string? Account, DateTime? LastSyncAt, string? LastError,
    int MatchedCourses, int TotalCourses, List<string> UnmatchedCourses);

/// <summary>
/// Mirrors Udemy completion onto the fixed course ladder. Strictly read-only for the domain:
/// a percentage here never unlocks a course, never completes one, and never writes a
/// <see cref="StudySession"/>. The artifact gate in <see cref="CoursePlanService"/> is untouched.
/// Nothing about the Udemy session lives here — the shell owns the cookie jar and does the fetching.
/// </summary>
public class UdemySyncService(AppDbContext db)
{
    /// <summary>The stable part of a Udemy course URL: /course/&lt;slug&gt;/ — how a plan course
    /// is matched to an enrollment, since titles drift and ids aren't in the seed.</summary>
    public static string? Slug(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;

        const string marker = "/course/";
        var i = url.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (i < 0) return null;

        var rest = url[(i + marker.Length)..].TrimStart('/');
        var end = rest.IndexOfAny(['/', '?', '#']);
        if (end >= 0) rest = rest[..end];
        return rest.Length == 0 ? null : rest.ToLowerInvariant();
    }

    public async Task<UdemyStatusDto> GetStatusAsync()
    {
        var settings = await db.AppSettings.FirstAsync();
        var courses = await db.PlanCourses.OrderBy(c => c.Order)
            .Select(c => new { c.Id, c.Title })
            .ToListAsync();
        var matchedIds = await db.UdemyProgress.Select(p => p.CourseId).ToListAsync();

        return new UdemyStatusDto(
            settings.UdemyConnected, settings.UdemyAccount, settings.UdemyLastSyncAt, settings.UdemyLastError,
            matchedIds.Count, courses.Count,
            courses.Where(c => !matchedIds.Contains(c.Id)).Select(c => c.Title).ToList());
    }

    public async Task<UdemyStatusDto> ApplyAsync(UdemySyncRequest req)
    {
        var settings = await db.AppSettings.FirstAsync();

        if (!string.IsNullOrWhiteSpace(req.Error))
        {
            // Keep what was already synced — a failed refresh is not a disconnect.
            settings.UdemyLastError = Truncate(req.Error, 500);
            await db.SaveChangesAsync();
            return await GetStatusAsync();
        }

        var bySlug = (await db.PlanCourses.ToListAsync())
            .Select(c => (Slug: Slug(c.Url), Course: c))
            .Where(x => x.Slug is not null)
            .ToDictionary(x => x.Slug!, x => x.Course);

        var existing = await db.UdemyProgress.ToDictionaryAsync(p => p.CourseId);
        var now = DateTime.Now;

        foreach (var input in req.Courses ?? [])
        {
            var slug = Slug(input.Url);
            if (slug is null || !bySlug.TryGetValue(slug, out var course)) continue; // not on the ladder

            if (!existing.TryGetValue(course.Id, out var row))
            {
                row = new UdemyProgress { CourseId = course.Id };
                db.UdemyProgress.Add(row);
                existing[course.Id] = row;
            }

            row.UdemyCourseId = input.Id;
            row.CompletionRatio = Math.Clamp(input.CompletionRatio ?? 0, 0, 100);
            row.LectureCount = input.LectureCount;
            row.LastAccessed = input.LastAccessed;
            row.SyncedAt = now;
        }

        settings.UdemyConnected = true;
        settings.UdemyAccount = Truncate(
            string.IsNullOrWhiteSpace(req.Account) ? settings.UdemyAccount ?? "Connected" : req.Account, 200);
        settings.UdemyLastSyncAt = now;
        settings.UdemyLastError = null;

        await db.SaveChangesAsync();
        return await GetStatusAsync();
    }

    public async Task<UdemyStatusDto> DisconnectAsync()
    {
        db.UdemyProgress.RemoveRange(await db.UdemyProgress.ToListAsync());

        var settings = await db.AppSettings.FirstAsync();
        settings.UdemyConnected = false;
        settings.UdemyAccount = null;
        settings.UdemyLastSyncAt = null;
        settings.UdemyLastError = null;

        await db.SaveChangesAsync();
        return await GetStatusAsync();
    }

    private static string? Truncate(string? value, int max) =>
        value is null ? null : value.Length <= max ? value : value[..max];
}
