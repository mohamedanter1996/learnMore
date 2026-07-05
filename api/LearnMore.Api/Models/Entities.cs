namespace LearnMore.Api.Models;

public class Topic
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Color { get; set; } = "#888888";
    public string Icon { get; set; } = "";
    public List<LearningItem> Items { get; set; } = [];
}

public class LearningItem
{
    public int Id { get; set; }
    public int TopicId { get; set; }
    public Topic Topic { get; set; } = null!;
    public string Title { get; set; } = "";
    public string BodyMarkdown { get; set; } = "";
    public string? ExplanationArabic { get; set; } // شرح مبسط بالمصري (markdown, optional)
    public int Difficulty { get; set; } = 1; // 1..3
    public int EstimatedMinutes { get; set; } = 15;
    public string PracticeTask { get; set; } = "";
    public string ExternalLinksJson { get; set; } = "[]";
    public int SortOrder { get; set; }
    public List<QuizQuestion> Quiz { get; set; } = [];
}

public class QuizQuestion
{
    public int Id { get; set; }
    public int LearningItemId { get; set; }
    public LearningItem LearningItem { get; set; } = null!;
    public string Question { get; set; } = "";
    public string OptionsJson { get; set; } = "[]";
    public int CorrectIndex { get; set; }
    public string Explanation { get; set; } = "";
}

public enum AssignmentStatus
{
    Pending = 0,
    Completed = 1
}

public class DailyAssignment
{
    public int Id { get; set; }
    public DateOnly Date { get; set; }
    public int LearningItemId { get; set; }
    public LearningItem LearningItem { get; set; } = null!;
    public AssignmentStatus Status { get; set; } = AssignmentStatus.Pending;
    public DateTime? CompletedAt { get; set; }
}

public class UserStats
{
    public int Id { get; set; }
    public int CurrentStreak { get; set; }
    public int LongestStreak { get; set; }
    public DateOnly? LastCompletedDate { get; set; }
    public int TotalCompleted { get; set; }
}

public class AppSettings
{
    public int Id { get; set; }
    public string ReminderTime { get; set; } = "09:00"; // HH:mm
    public int ReminderRepeatHours { get; set; } = 2;
    public bool NotificationsEnabled { get; set; } = true;
}

public class InterviewQuestion
{
    public int Id { get; set; }
    public int TopicId { get; set; }
    public Topic Topic { get; set; } = null!;
    public int Level { get; set; } // 1 Junior, 2 Mid, 3 Senior
    public string Question { get; set; } = "";
    public string OptionsJson { get; set; } = "[]";
    public int CorrectIndex { get; set; }
    public string Explanation { get; set; } = "";
    public string? RelatedLessonTitle { get; set; } // maps a miss to the lesson that teaches it
}

public class AssessmentAttempt
{
    public int Id { get; set; }
    public int TopicId { get; set; }
    public Topic Topic { get; set; } = null!;
    public DateTime TakenAt { get; set; }
    public int JuniorCorrect { get; set; }
    public int JuniorTotal { get; set; }
    public int MidCorrect { get; set; }
    public int MidTotal { get; set; }
    public int SeniorCorrect { get; set; }
    public int SeniorTotal { get; set; }
    public int ResultLevel { get; set; } // 0 Beginner .. 3 Senior
    public List<AssessmentAnswer> Answers { get; set; } = [];
}

public class AssessmentAnswer
{
    public int Id { get; set; }
    public int AttemptId { get; set; }
    public AssessmentAttempt Attempt { get; set; } = null!;
    public int QuestionId { get; set; }
    public InterviewQuestion Question { get; set; } = null!;
    public int SelectedIndex { get; set; }
    public bool IsCorrect { get; set; }
}
