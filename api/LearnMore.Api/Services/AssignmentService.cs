using LearnMore.Api.Data;
using LearnMore.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LearnMore.Api.Services;

public class AssignmentService(AppDbContext db)
{
    public static DateOnly Today => DateOnly.FromDateTime(DateTime.Now);

    /// <summary>
    /// Returns today's assignment, creating one if it doesn't exist yet.
    /// A lesson left unfinished on an earlier day is carried forward instead of being skipped:
    /// the ladder pauses there until it is completed (oldest unfinished day first).
    /// Otherwise topic selection is round-robin (least recently assigned topic first);
    /// item selection is the lowest unseen difficulty tier within that topic.
    /// </summary>
    public async Task<DailyAssignment> GetOrCreateTodayAsync()
    {
        var today = Today;
        var existing = await db.DailyAssignments
            .Include(a => a.LearningItem).ThenInclude(i => i.Topic)
            .Include(a => a.LearningItem).ThenInclude(i => i.Quiz)
            .FirstOrDefaultAsync(a => a.Date == today);
        if (existing is not null) return existing;

        // A missed day keeps its row (as Missed, so history stays honest) and hands its lesson to today.
        var stale = await db.DailyAssignments
            .Where(a => a.Date < today && a.Status == AssignmentStatus.Pending)
            .OrderBy(a => a.Date)
            .FirstOrDefaultAsync();

        int itemId;
        DateOnly? carriedFrom = null;
        if (stale is not null)
        {
            itemId = stale.LearningItemId;
            carriedFrom = stale.CarriedFromDate ?? stale.Date; // survives repeated roll-forwards
            stale.Status = AssignmentStatus.Missed;
        }
        else
        {
            itemId = (await PickNextItemAsync()).Id;
        }

        var assignment = new DailyAssignment
        {
            Date = today,
            LearningItemId = itemId,
            CarriedFromDate = carriedFrom
        };
        db.DailyAssignments.Add(assignment);
        await db.SaveChangesAsync();

        return await db.DailyAssignments
            .Include(a => a.LearningItem).ThenInclude(i => i.Topic)
            .Include(a => a.LearningItem).ThenInclude(i => i.Quiz)
            .FirstAsync(a => a.Id == assignment.Id);
    }

    private async Task<LearningItem> PickNextItemAsync()
    {
        // Topics ordered round-robin: never-assigned topics first, then least recently assigned.
        var topicOrder = await db.Topics
            .Select(t => new
            {
                t.Id,
                LastAssigned = db.DailyAssignments
                    .Where(a => a.LearningItem.TopicId == t.Id)
                    .Max(a => (DateOnly?)a.Date)
            })
            .OrderBy(t => t.LastAssigned.HasValue) // false (never assigned) first
            .ThenBy(t => t.LastAssigned)
            .ThenBy(t => t.Id)
            .Select(t => t.Id)
            .ToListAsync();

        var assignedItemIds = db.DailyAssignments.Select(a => a.LearningItemId);

        foreach (var topicId in topicOrder)
        {
            var next = await db.LearningItems
                .Where(i => i.TopicId == topicId && !assignedItemIds.Contains(i.Id))
                .OrderBy(i => i.Difficulty).ThenBy(i => i.SortOrder).ThenBy(i => i.Id)
                .FirstOrDefaultAsync();
            if (next is not null) return next;
        }

        // Whole bank exhausted: recycle the item assigned longest ago (review mode).
        var review = await db.LearningItems
            .OrderBy(i => db.DailyAssignments
                .Where(a => a.LearningItemId == i.Id)
                .Max(a => (DateOnly?)a.Date))
            .ThenBy(i => i.Id)
            .FirstOrDefaultAsync();

        return review ?? throw new InvalidOperationException(
            "No learning items in the database. Check that seeding ran (seed/ directory present).");
    }

    /// <summary>
    /// Validates quiz answers; if all correct, marks today complete and updates streak.
    /// </summary>
    public async Task<CompletionResult> CompleteTodayAsync(Dictionary<int, int> answersByQuestionId)
    {
        var assignment = await GetOrCreateTodayAsync();

        var results = assignment.LearningItem.Quiz
            .Select(q => new QuestionResult(
                q.Id,
                answersByQuestionId.TryGetValue(q.Id, out var sel) && sel == q.CorrectIndex,
                q.CorrectIndex,
                q.Explanation))
            .ToList();

        var allCorrect = results.All(r => r.Correct);
        if (!allCorrect || assignment.Status == AssignmentStatus.Completed)
            return new CompletionResult(assignment.Status == AssignmentStatus.Completed, allCorrect, results);

        assignment.Status = AssignmentStatus.Completed;
        assignment.CompletedAt = DateTime.Now;

        var stats = await db.UserStats.FirstAsync();
        var today = Today;
        stats.CurrentStreak = stats.LastCompletedDate == today.AddDays(-1) ? stats.CurrentStreak + 1 : 1;
        stats.LongestStreak = Math.Max(stats.LongestStreak, stats.CurrentStreak);
        stats.LastCompletedDate = today;
        stats.TotalCompleted++;

        await db.SaveChangesAsync();
        return new CompletionResult(true, true, results);
    }
}

public record QuestionResult(int QuestionId, bool Correct, int CorrectIndex, string Explanation);
public record CompletionResult(bool Completed, bool AllCorrect, List<QuestionResult> Results);
