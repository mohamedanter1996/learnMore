using LearnMore.Api.Data;
using LearnMore.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LearnMore.Api.Services;

public record StudyGoalDto(int Id, string Text, bool IsDone, int SortOrder);
public record StudyDayDto(string Date, bool Studied);

public record StudyPlanSummaryDto(int Id, string Title, DateOnly StartDate, DateOnly EndDate,
    int GoalsDone, int GoalsTotal, int StudiedDays, int TotalDays, int DaysRemaining);

public record StudyPlanDetailDto(int Id, string Title, DateOnly StartDate, DateOnly EndDate,
    int GoalsDone, int GoalsTotal, int StudiedDays, int TotalDays, int DaysRemaining, int StudyStreak,
    List<StudyGoalDto> Goals, List<StudyDayDto> Days);

public record CreatePlanDto(string Title, DateOnly StartDate, DateOnly EndDate);
public record AddGoalDto(string Text);

public class StudyPlanService(AppDbContext db)
{
    private static int TotalDays(StudyPlan p) => Math.Max(1, p.EndDate.DayNumber - p.StartDate.DayNumber + 1);

    private static int DaysRemaining(StudyPlan p)
    {
        var today = DateOnly.FromDateTime(DateTime.Now);
        if (today > p.EndDate) return 0;
        var from = today < p.StartDate ? p.StartDate : today;
        return p.EndDate.DayNumber - from.DayNumber + 1;
    }

    public async Task<List<StudyPlanSummaryDto>> GetPlansAsync() =>
        (await db.StudyPlans
            .Include(p => p.Goals)
            .Include(p => p.DayLogs)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync())
        .Select(ToSummary)
        .ToList();

    private static StudyPlanSummaryDto ToSummary(StudyPlan p) => new(
        p.Id, p.Title, p.StartDate, p.EndDate,
        p.Goals.Count(g => g.IsDone), p.Goals.Count,
        p.DayLogs.Count(d => d.Studied), TotalDays(p), DaysRemaining(p));

    public async Task<StudyPlanDetailDto?> GetPlanAsync(int id)
    {
        var p = await db.StudyPlans
            .Include(x => x.Goals)
            .Include(x => x.DayLogs)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (p is null) return null;

        var logByDate = p.DayLogs.Where(d => d.Studied).Select(d => d.Date).ToHashSet();

        // Full calendar span start→end, marking studied days.
        var days = new List<StudyDayDto>();
        for (var d = p.StartDate; d <= p.EndDate; d = d.AddDays(1))
            days.Add(new StudyDayDto(d.ToString("yyyy-MM-dd"), logByDate.Contains(d)));

        return new StudyPlanDetailDto(
            p.Id, p.Title, p.StartDate, p.EndDate,
            p.Goals.Count(g => g.IsDone), p.Goals.Count,
            logByDate.Count, TotalDays(p), DaysRemaining(p), StudyStreak(logByDate),
            p.Goals.OrderBy(g => g.SortOrder).ThenBy(g => g.Id)
                .Select(g => new StudyGoalDto(g.Id, g.Text, g.IsDone, g.SortOrder)).ToList(),
            days);
    }

    /// <summary>Consecutive studied days ending today (or yesterday if today not yet logged).</summary>
    private static int StudyStreak(HashSet<DateOnly> studied)
    {
        var today = DateOnly.FromDateTime(DateTime.Now);
        var cursor = studied.Contains(today) ? today : today.AddDays(-1);
        var streak = 0;
        while (studied.Contains(cursor)) { streak++; cursor = cursor.AddDays(-1); }
        return streak;
    }

    public async Task<StudyPlanSummaryDto> CreatePlanAsync(CreatePlanDto dto)
    {
        var end = dto.EndDate < dto.StartDate ? dto.StartDate : dto.EndDate;
        var plan = new StudyPlan
        {
            Title = string.IsNullOrWhiteSpace(dto.Title) ? "Study Plan" : dto.Title.Trim(),
            StartDate = dto.StartDate,
            EndDate = end,
            CreatedAt = DateTime.Now
        };
        db.StudyPlans.Add(plan);
        await db.SaveChangesAsync();
        return ToSummary(plan);
    }

    public async Task<bool> DeletePlanAsync(int id)
    {
        var plan = await db.StudyPlans.FindAsync(id);
        if (plan is null) return false;
        db.StudyPlans.Remove(plan);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<StudyGoalDto?> AddGoalAsync(int planId, string text)
    {
        var plan = await db.StudyPlans.Include(p => p.Goals).FirstOrDefaultAsync(p => p.Id == planId);
        if (plan is null || string.IsNullOrWhiteSpace(text)) return null;
        var goal = new StudyPlanGoal
        {
            PlanId = planId,
            Text = text.Trim(),
            SortOrder = plan.Goals.Count == 0 ? 0 : plan.Goals.Max(g => g.SortOrder) + 1
        };
        db.StudyPlanGoals.Add(goal);
        await db.SaveChangesAsync();
        return new StudyGoalDto(goal.Id, goal.Text, goal.IsDone, goal.SortOrder);
    }

    public async Task<bool> ToggleGoalAsync(int goalId)
    {
        var goal = await db.StudyPlanGoals.FindAsync(goalId);
        if (goal is null) return false;
        goal.IsDone = !goal.IsDone;
        goal.DoneAt = goal.IsDone ? DateTime.Now : null;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteGoalAsync(int goalId)
    {
        var goal = await db.StudyPlanGoals.FindAsync(goalId);
        if (goal is null) return false;
        db.StudyPlanGoals.Remove(goal);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ToggleDayAsync(int planId, DateOnly date)
    {
        var plan = await db.StudyPlans.FindAsync(planId);
        if (plan is null || date < plan.StartDate || date > plan.EndDate) return false;

        var log = await db.StudyDayLogs.FirstOrDefaultAsync(d => d.PlanId == planId && d.Date == date);
        if (log is null)
            db.StudyDayLogs.Add(new StudyDayLog { PlanId = planId, Date = date, Studied = true });
        else
            log.Studied = !log.Studied;

        await db.SaveChangesAsync();
        return true;
    }
}
