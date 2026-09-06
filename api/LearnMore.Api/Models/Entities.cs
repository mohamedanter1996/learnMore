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

// --------------------------------------------------------------- scenarios
// A business situation that unfolds in stages. You type what you would actually
// do; the answer is graded against an authored rubric, never against a model
// answer. Content is seeded from seed/scenarios/*.json and is never editable
// from the UI, exactly like the course ladder.

public class Scenario
{
    public int Id { get; set; }
    public string Slug { get; set; } = "";
    public string Title { get; set; } = "";
    public string Domain { get; set; } = "";
    public int Difficulty { get; set; } = 2; // 1..3
    public int EstimatedMinutes { get; set; } = 20;
    public int SortOrder { get; set; }
    public string ContextMarkdown { get; set; } = "";
    public string StakeholdersMarkdown { get; set; } = "";
    public string ConstraintsMarkdown { get; set; } = "";
    public List<ScenarioStage> Stages { get; set; } = [];
}

public class ScenarioStage
{
    public int Id { get; set; }
    public int ScenarioId { get; set; }
    public Scenario Scenario { get; set; } = null!;
    public int Order { get; set; }
    public string? Label { get; set; }
    public string Prompt { get; set; } = "";
    public string InputHint { get; set; } = "";
    /// <summary>Shown only after the stage is answered, and never sent to the grader:
    /// a grader that can see it starts matching phrasing instead of judging substance.</summary>
    public string ModelAnswerMarkdown { get; set; } = "";
    /// <summary>New information revealed after answering. This is what makes a scenario
    /// feel like a real week rather than a quiz.</summary>
    public string RevealMarkdown { get; set; } = "";
    public List<ScenarioRubricPoint> RubricPoints { get; set; } = [];
}

public class ScenarioRubricPoint
{
    public int Id { get; set; }
    public int StageId { get; set; }
    public ScenarioStage Stage { get; set; } = null!;
    public string Text { get; set; } = "";
    public int Weight { get; set; } = 1; // 1..3
    /// <summary>Skill axis, e.g. measures-first. The cross-scenario weakness view groups by it,
    /// which is why it is a normalized column and not part of a JSON blob.</summary>
    public string Tag { get; set; } = "";
    public int SortOrder { get; set; }
}

public enum ScenarioRunStatus
{
    InProgress = 0,
    Completed = 1,
    Abandoned = 2
}

public enum CoverageVerdict
{
    Miss = 0,
    Partial = 1,
    Hit = 2
}

/// <summary>One attempt at one scenario. There is deliberately no stored cursor and no stored
/// total: position is the lowest-Order stage without a graded answer, and the score is a pure
/// function of the coverage rows. Both are computed on read, as everywhere else in this app.</summary>
public class ScenarioRun
{
    public int Id { get; set; }
    public int ScenarioId { get; set; }
    public Scenario Scenario { get; set; } = null!;
    public DateTime StartedAt { get; set; }
    /// <summary>Set once when the run ends. Never re-derived by counting stages, or a scenario
    /// that later gains a stage would silently un-complete your history.</summary>
    public DateTime? CompletedAt { get; set; }
    public ScenarioRunStatus Status { get; set; } = ScenarioRunStatus.InProgress;
    public List<ScenarioAnswer> Answers { get; set; } = [];
}

public class ScenarioAnswer
{
    public int Id { get; set; }
    public int RunId { get; set; }
    public ScenarioRun Run { get; set; } = null!;
    public int StageId { get; set; }
    public ScenarioStage Stage { get; set; } = null!;
    public string AnswerText { get; set; } = "";
    public DateTime SubmittedAt { get; set; }
    /// <summary>Display prose from the coach: strengths, gaps, seniorMove, arabicSummary.
    /// A payload that is rendered whole and never queried by field, so it stays JSON.</summary>
    public string? FeedbackJson { get; set; }
    /// <summary>Comes back with the grade in the same call, so a probe never costs a second one.</summary>
    public string? ProbeQuestion { get; set; }
    public string? ProbeAnswerText { get; set; }
    /// <summary>Set when grading failed, so the UI can offer Retry without losing the answer.</summary>
    public string? GradeError { get; set; }
    /// <summary>Which model graded this, so token counts and grades stay attributable.</summary>
    public string? Model { get; set; }
    public int InputTokens { get; set; }
    public int OutputTokens { get; set; }
    /// <summary>Empty means ungraded. That is the whole representation of the ungraded state.</summary>
    public List<ScenarioCoverage> Coverage { get; set; } = [];
}

/// <summary>How one rubric point fared against one answer. Holds both verdicts so the coach path
/// and the self-score path are one table with one read rule, and so disagreeing with a grade is a
/// one-click write that improves the weakness signal instead of poisoning it.</summary>
public class ScenarioCoverage
{
    public int Id { get; set; }
    public int AnswerId { get; set; }
    public ScenarioAnswer Answer { get; set; } = null!;
    public int RubricPointId { get; set; }
    public ScenarioRubricPoint RubricPoint { get; set; } = null!;
    /// <summary>What the coach reported. Null on a purely self-scored answer.</summary>
    public CoverageVerdict? LlmVerdict { get; set; }
    /// <summary>Your own call, which wins. Effective verdict is UserVerdict ?? LlmVerdict ?? Miss.</summary>
    public CoverageVerdict? UserVerdict { get; set; }
    /// <summary>The verbatim quote the coach used to justify a hit.</summary>
    public string Evidence { get; set; } = "";
    /// <summary>The coach claimed a hit but its quote was not actually in the answer, so it was
    /// downgraded to partial. A model that must quote cannot reward hand-waving.</summary>
    public bool QuoteUnverified { get; set; }
}

// -------------------------------------------------------------------- coach
// The Anthropic key that grades scenario answers. Deliberately its own entity and NOT a field
// on AppSettings: AppSettings is round-tripped whole by the settings screen, and a secret on
// that object is one careless DTO field away from being echoed back to the client.

public class CoachSettings
{
    public int Id { get; set; }
    /// <summary>DPAPI ciphertext, base64. Never leaves the API, never logged, never returned.</summary>
    public string? ApiKeyProtected { get; set; }
    /// <summary>Last four characters, so the UI can show which key is stored without decrypting.</summary>
    public string? KeyHint { get; set; }
    public string Model { get; set; } = "claude-opus-5";
    public string? LastError { get; set; }
    public DateTime? LastCallAt { get; set; }
    /// <summary>Grading calls made on CallsDate. The API binds localhost with no authentication
    /// and now fronts a billable endpoint, so this cap is the only real spend control there is.</summary>
    public int CallsToday { get; set; }
    public DateOnly? CallsDate { get; set; }
}
