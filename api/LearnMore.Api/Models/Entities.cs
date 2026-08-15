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
    Completed = 1,
    /// <summary>Day went by unfinished; the lesson was carried forward to a later day.</summary>
    Missed = 2
}

public class DailyAssignment
{
    public int Id { get; set; }
    public DateOnly Date { get; set; }
    public int LearningItemId { get; set; }
    public LearningItem LearningItem { get; set; } = null!;
    public AssignmentStatus Status { get; set; } = AssignmentStatus.Pending;
    public DateTime? CompletedAt { get; set; }
    /// <summary>Date this lesson was first served, when it was carried over from a missed day.</summary>
    public DateOnly? CarriedFromDate { get; set; }
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

    // Udemy connection state. The session itself lives in the Electron shell's cookie jar —
    // no token is ever stored here.
    public bool UdemyConnected { get; set; }
    public string? UdemyAccount { get; set; }
    public DateTime? UdemyLastSyncAt { get; set; }
    public string? UdemyLastError { get; set; }
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

public class StudyPlan
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<StudyPlanGoal> Goals { get; set; } = [];
    public List<StudyDayLog> DayLogs { get; set; } = [];
}

public class StudyPlanGoal
{
    public int Id { get; set; }
    public int PlanId { get; set; }
    public StudyPlan Plan { get; set; } = null!;
    public string Text { get; set; } = "";
    public bool IsDone { get; set; }
    public DateTime? DoneAt { get; set; }
    public int SortOrder { get; set; }
}

public class StudyDayLog
{
    public int Id { get; set; }
    public int PlanId { get; set; }
    public StudyPlan Plan { get; set; } = null!;
    public DateOnly Date { get; set; }
    public bool Studied { get; set; }
}

// ------------------------------------------------------------- course plan
// A fixed, ordered ladder of courses. Exactly one is Active at a time; the plan
// itself is seeded from code and is never edited from the UI.
// Named PlanCourse because Services.Course (the recommendation catalog record)
// already owns the name "Course".

public enum CourseStatus
{
    Locked = 0,
    Active = 1,
    Done = 2
}

public enum ArtifactType
{
    Article = 0,
    Post = 1,
    Commit = 2,
    Other = 3
}

public class PlanCourse
{
    public int Id { get; set; }
    public int Order { get; set; }
    public string Title { get; set; } = "";
    public string Instructor { get; set; } = "";
    public string Url { get; set; } = "";
    public int EstimatedHours { get; set; }
    public CourseStatus Status { get; set; } = CourseStatus.Locked;
    public int RequiredArtifacts { get; set; } = 2;
    public bool IsCheckpoint { get; set; } // pause gate after this course
    public DateTime? StartedOn { get; set; }
    public DateTime? CompletedOn { get; set; }
    public List<StudySession> Sessions { get; set; } = [];
    public List<Artifact> Artifacts { get; set; } = [];
}

/// <summary>Where a session's minutes came from. Provenance for display only — the streak
/// counts both alike, because a session is a session however it got typed.</summary>
public enum SessionSource
{
    Manual = 0,
    Udemy = 1
}

public class StudySession
{
    public int Id { get; set; }
    public int CourseId { get; set; }
    public PlanCourse Course { get; set; } = null!;
    public DateOnly Date { get; set; }
    public int Minutes { get; set; }
    public string Note { get; set; } = "";
    public SessionSource Source { get; set; } = SessionSource.Manual;
}

/// <summary>Proof something was produced, not just watched.</summary>
public class Artifact
{
    public int Id { get; set; }
    public int CourseId { get; set; }
    public PlanCourse Course { get; set; } = null!;
    public ArtifactType Type { get; set; }
    public string Title { get; set; } = "";
    public string? Url { get; set; }
    public DateTime CreatedOn { get; set; }
}

/// <summary>
/// What Udemy reports for a plan course, mirrored here by the Electron shell. Read-only
/// display: it never unlocks a course, never completes one, and never creates sessions.
/// Kept off <see cref="PlanCourse"/> so the ladder stays a pure domain entity.
/// </summary>
public class UdemyProgress
{
    public int Id { get; set; }
    public int CourseId { get; set; }
    public PlanCourse Course { get; set; } = null!;
    public long UdemyCourseId { get; set; }
    public double CompletionRatio { get; set; } // 0..100
    public int? LectureCount { get; set; }
    public DateTime? LastAccessed { get; set; }
    public DateTime SyncedAt { get; set; }

    // Session suggestion. A sync parks the minutes it has seen since the last one here;
    // only an explicit click turns them into a StudySession.
    public string CompletedLectureIdsJson { get; set; } = "[]";
    /// <summary>Total minutes of completed lectures as of the last sync — the diffing baseline.</summary>
    public double WatchedMinutesTotal { get; set; }
    /// <summary>Unclaimed minutes waiting to be logged or dismissed. Active course only.</summary>
    public int PendingMinutes { get; set; }
    public DateTime? PendingSince { get; set; }
    /// <summary>The pending minutes came from the completion-ratio fallback, not lecture durations.</summary>
    public bool IsEstimated { get; set; }
}
