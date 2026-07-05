using System.Text.Json;
using LearnMore.Api.Models;

namespace LearnMore.Api;

public record TopicSummaryDto(int Id, string Name, string Color, string Icon, int Total, int Completed);

public record QuizDto(int Id, string Question, List<string> Options, int? CorrectIndex, string? Explanation);

public record ItemDto(
    int Id, string Title, int Difficulty, int EstimatedMinutes,
    string BodyMarkdown, string? ExplanationArabic, string PracticeTask, List<string> ExternalLinks,
    int TopicId, string TopicName, string TopicColor, string TopicIcon,
    List<QuizDto> Quiz);

public record TodayDto(int AssignmentId, DateOnly Date, string Status, DateTime? CompletedAt, ItemDto Item);

public record TopicItemRowDto(int Id, string Title, int Difficulty, int EstimatedMinutes, string Status);

public record CalendarDayDto(DateOnly Date, string Status); // completed | missed | pending | none

public record StatsDto(
    int CurrentStreak, int LongestStreak, int TotalCompleted, int TotalItems,
    List<TopicSummaryDto> PerTopic, List<CalendarDayDto> Calendar);

public record SettingsDto(string ReminderTime, int ReminderRepeatHours, bool NotificationsEnabled);

public record AnswerDto(int QuestionId, int SelectedIndex);
public record CompleteRequestDto(List<AnswerDto> Answers);

public static class Mapping
{
    public static ItemDto ToItemDto(this LearningItem i, bool revealAnswers) => new(
        i.Id, i.Title, i.Difficulty, i.EstimatedMinutes,
        i.BodyMarkdown, i.ExplanationArabic, i.PracticeTask,
        JsonSerializer.Deserialize<List<string>>(i.ExternalLinksJson) ?? [],
        i.TopicId, i.Topic.Name, i.Topic.Color, i.Topic.Icon,
        i.Quiz.Select(q => new QuizDto(
            q.Id, q.Question,
            JsonSerializer.Deserialize<List<string>>(q.OptionsJson) ?? [],
            revealAnswers ? q.CorrectIndex : null,
            revealAnswers ? q.Explanation : null)).ToList());

    public static TodayDto ToTodayDto(this DailyAssignment a)
    {
        var completed = a.Status == AssignmentStatus.Completed;
        return new TodayDto(a.Id, a.Date, completed ? "completed" : "pending", a.CompletedAt,
            a.LearningItem.ToItemDto(revealAnswers: completed));
    }
}
