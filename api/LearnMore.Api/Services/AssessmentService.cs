using System.Text.Json;
using LearnMore.Api.Data;
using LearnMore.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LearnMore.Api.Services;

public record TierScore(int Level, int Correct, int Total);

public record AttemptSummaryDto(int AttemptId, DateTime TakenAt, int ResultLevel, string LevelName,
    List<TierScore> Tiers);

public record AssessmentTopicDto(int TopicId, string Name, string Color, string Icon,
    int QuestionCount, AttemptSummaryDto? LastAttempt);

public record AssessmentQuestionDto(int Id, int Level, string Question, List<string> Options);

public record RelatedLessonDto(int Id, string Title, string Status);

public record WrongAnswerDto(int QuestionId, string Question, int SelectedIndex, int CorrectIndex,
    List<string> Options, string Explanation, RelatedLessonDto? RelatedLesson);

public record AssessmentResultDto(int AttemptId, int TopicId, string TopicName, int ResultLevel,
    string LevelName, string NextLevelName, List<TierScore> Tiers, List<WrongAnswerDto> WrongAnswers,
    List<Course> RecommendedCourses);

public record RoadmapLessonDto(int Id, string Title, string Status, bool IsWeak);
public record RoadmapTierDto(int Level, string Name, List<RoadmapLessonDto> Lessons);
public record RoadmapTopicDto(int TopicId, string Name, string Color, string Icon,
    int? AssessmentLevel, string? AssessmentLevelName, DateTime? AssessedAt, List<RoadmapTierDto> Tiers);

public class AssessmentService(AppDbContext db, CourseCatalogService courses)
{
    public static readonly string[] LevelNames = ["Beginner", "Junior", "Mid-Level", "Senior"];

    private static string NameOf(int level) => LevelNames[Math.Clamp(level, 0, 3)];

    // ------------------------------------------------------------------ overview

    public async Task<List<AssessmentTopicDto>> GetOverviewAsync()
    {
        var topics = await db.Topics.OrderBy(t => t.Id).ToListAsync();
        var counts = await db.InterviewQuestions
            .GroupBy(q => q.TopicId)
            .Select(g => new { TopicId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TopicId, x => x.Count);

        var result = new List<AssessmentTopicDto>();
        foreach (var t in topics)
        {
            var last = await db.AssessmentAttempts
                .Where(a => a.TopicId == t.Id)
                .OrderByDescending(a => a.TakenAt)
                .FirstOrDefaultAsync();
            result.Add(new AssessmentTopicDto(t.Id, t.Name, t.Color, t.Icon,
                counts.GetValueOrDefault(t.Id), last is null ? null : ToSummary(last)));
        }
        return result;
    }

    private static AttemptSummaryDto ToSummary(AssessmentAttempt a) => new(
        a.Id, a.TakenAt, a.ResultLevel, NameOf(a.ResultLevel),
        [
            new TierScore(1, a.JuniorCorrect, a.JuniorTotal),
            new TierScore(2, a.MidCorrect, a.MidTotal),
            new TierScore(3, a.SeniorCorrect, a.SeniorTotal)
        ]);

    // ------------------------------------------------------------------ questions

    public async Task<List<AssessmentQuestionDto>> GetQuestionsAsync(int topicId)
    {
        var questions = await db.InterviewQuestions
            .Where(q => q.TopicId == topicId)
            .ToListAsync();

        // Shuffle within level, keep levels ordered easy → hard.
        var rng = Random.Shared;
        return questions
            .GroupBy(q => q.Level)
            .OrderBy(g => g.Key)
            .SelectMany(g => g.OrderBy(_ => rng.Next()))
            .Select(q => new AssessmentQuestionDto(q.Id, q.Level, q.Question,
                JsonSerializer.Deserialize<List<string>>(q.OptionsJson) ?? []))
            .ToList();
    }

    // ------------------------------------------------------------------ submit

    public async Task<AssessmentResultDto?> SubmitAsync(int topicId, Dictionary<int, int> answers)
    {
        var topic = await db.Topics.FindAsync(topicId);
        if (topic is null) return null;

        var questions = await db.InterviewQuestions
            .Where(q => q.TopicId == topicId)
            .ToListAsync();
        if (questions.Count == 0) return null;

        var attempt = new AssessmentAttempt { TopicId = topicId, TakenAt = DateTime.Now };
        var wrong = new List<(InterviewQuestion Q, int Selected)>();

        foreach (var q in questions)
        {
            var answered = answers.TryGetValue(q.Id, out var selected);
            var correct = answered && selected == q.CorrectIndex;

            switch (q.Level)
            {
                case 1: attempt.JuniorTotal++; if (correct) attempt.JuniorCorrect++; break;
                case 2: attempt.MidTotal++; if (correct) attempt.MidCorrect++; break;
                default: attempt.SeniorTotal++; if (correct) attempt.SeniorCorrect++; break;
            }

            attempt.Answers.Add(new AssessmentAnswer
            {
                QuestionId = q.Id,
                SelectedIndex = answered ? selected : -1,
                IsCorrect = correct
            });
            if (!correct) wrong.Add((q, answered ? selected : -1));
        }

        attempt.ResultLevel = ComputeLevel(attempt);
        db.AssessmentAttempts.Add(attempt);
        await db.SaveChangesAsync();

        return await BuildResultAsync(attempt, topic, wrong);
    }

    /// <summary>
    /// Junior: junior tier ≥ 70%. Mid: junior achieved AND mid ≥ 60%.
    /// Senior: mid achieved AND senior ≥ 60%. Level = highest achieved.
    /// </summary>
    private static int ComputeLevel(AssessmentAttempt a)
    {
        static double Pct(int correct, int total) => total == 0 ? 0 : (double)correct / total;

        var level = 0;
        if (Pct(a.JuniorCorrect, a.JuniorTotal) >= 0.70) level = 1;
        if (level >= 1 && Pct(a.MidCorrect, a.MidTotal) >= 0.60) level = 2;
        if (level >= 2 && Pct(a.SeniorCorrect, a.SeniorTotal) >= 0.60) level = 3;
        return level;
    }

    private async Task<AssessmentResultDto> BuildResultAsync(
        AssessmentAttempt attempt, Topic topic, List<(InterviewQuestion Q, int Selected)> wrong)
    {
        var relatedTitles = wrong
            .Where(w => w.Q.RelatedLessonTitle != null)
            .Select(w => w.Q.RelatedLessonTitle!)
            .Distinct()
            .ToList();

        var relatedLessons = await db.LearningItems
            .Where(i => i.TopicId == topic.Id && relatedTitles.Contains(i.Title))
            .Select(i => new
            {
                i.Id,
                i.Title,
                Completed = db.DailyAssignments.Any(a =>
                    a.LearningItemId == i.Id && a.Status == AssignmentStatus.Completed)
            })
            .ToDictionaryAsync(i => i.Title,
                i => new RelatedLessonDto(i.Id, i.Title, i.Completed ? "completed" : "locked"));

        var wrongDtos = wrong.Select(w => new WrongAnswerDto(
            w.Q.Id, w.Q.Question, w.Selected, w.Q.CorrectIndex,
            JsonSerializer.Deserialize<List<string>>(w.Q.OptionsJson) ?? [],
            w.Q.Explanation,
            w.Q.RelatedLessonTitle != null ? relatedLessons.GetValueOrDefault(w.Q.RelatedLessonTitle) : null))
            .ToList();

        // Recommend courses for the next level to reach (capped at Senior).
        var targetLevel = Math.Min(attempt.ResultLevel + 1, 3);
        var recommended = courses.GetCourses(topic.Name, targetLevel);
        if (recommended.Count == 0) recommended = courses.GetCourses(topic.Name);

        return new AssessmentResultDto(
            attempt.Id, topic.Id, topic.Name, attempt.ResultLevel, NameOf(attempt.ResultLevel),
            NameOf(targetLevel), ToSummary(attempt).Tiers, wrongDtos, recommended);
    }

    // ------------------------------------------------------------------ result replay + history

    public async Task<AssessmentResultDto?> GetResultAsync(int attemptId)
    {
        var attempt = await db.AssessmentAttempts
            .Include(a => a.Topic)
            .Include(a => a.Answers).ThenInclude(ans => ans.Question)
            .FirstOrDefaultAsync(a => a.Id == attemptId);
        if (attempt is null) return null;

        var wrong = attempt.Answers
            .Where(a => !a.IsCorrect)
            .Select(a => (a.Question, a.SelectedIndex))
            .ToList();
        return await BuildResultAsync(attempt, attempt.Topic, wrong);
    }

    public async Task<List<AttemptSummaryDto>> GetHistoryAsync(int topicId) =>
        (await db.AssessmentAttempts
            .Where(a => a.TopicId == topicId)
            .OrderByDescending(a => a.TakenAt)
            .ToListAsync())
        .Select(ToSummary)
        .ToList();

    // ------------------------------------------------------------------ roadmap

    public async Task<List<RoadmapTopicDto>> GetRoadmapAsync()
    {
        var today = AssignmentService.Today;
        var topics = await db.Topics.OrderBy(t => t.Id).ToListAsync();
        var result = new List<RoadmapTopicDto>();

        foreach (var topic in topics)
        {
            var lastAttempt = await db.AssessmentAttempts
                .Where(a => a.TopicId == topic.Id)
                .OrderByDescending(a => a.TakenAt)
                .FirstOrDefaultAsync();

            // Weak lessons = related lessons of wrong answers in the latest attempt.
            var weakTitles = lastAttempt is null
                ? []
                : await db.AssessmentAnswers
                    .Where(a => a.AttemptId == lastAttempt.Id && !a.IsCorrect
                                && a.Question.RelatedLessonTitle != null)
                    .Select(a => a.Question.RelatedLessonTitle!)
                    .Distinct()
                    .ToListAsync();

            var lessons = await db.LearningItems
                .Where(i => i.TopicId == topic.Id)
                .OrderBy(i => i.Difficulty).ThenBy(i => i.SortOrder).ThenBy(i => i.Id)
                .Select(i => new
                {
                    i.Id,
                    i.Title,
                    i.Difficulty,
                    Status = db.DailyAssignments.Any(a =>
                            a.LearningItemId == i.Id && a.Status == AssignmentStatus.Completed)
                        ? "completed"
                        : db.DailyAssignments.Any(a => a.LearningItemId == i.Id && a.Date == today)
                            ? "today"
                            : "upcoming"
                })
                .ToListAsync();

            var tiers = lessons
                .GroupBy(l => l.Difficulty)
                .OrderBy(g => g.Key)
                .Select(g => new RoadmapTierDto(g.Key, NameOf(g.Key),
                    g.Select(l => new RoadmapLessonDto(l.Id, l.Title, l.Status,
                        weakTitles.Contains(l.Title))).ToList()))
                .ToList();

            result.Add(new RoadmapTopicDto(topic.Id, topic.Name, topic.Color, topic.Icon,
                lastAttempt?.ResultLevel, lastAttempt is null ? null : NameOf(lastAttempt.ResultLevel),
                lastAttempt?.TakenAt, tiers));
        }

        return result;
    }
}
