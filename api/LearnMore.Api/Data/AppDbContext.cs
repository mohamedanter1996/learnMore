using LearnMore.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace LearnMore.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Topic> Topics => Set<Topic>();
    public DbSet<LearningItem> LearningItems => Set<LearningItem>();
    public DbSet<QuizQuestion> QuizQuestions => Set<QuizQuestion>();
    public DbSet<DailyAssignment> DailyAssignments => Set<DailyAssignment>();
    public DbSet<UserStats> UserStats => Set<UserStats>();
    public DbSet<AppSettings> AppSettings => Set<AppSettings>();
    public DbSet<InterviewQuestion> InterviewQuestions => Set<InterviewQuestion>();
    public DbSet<AssessmentAttempt> AssessmentAttempts => Set<AssessmentAttempt>();
    public DbSet<AssessmentAnswer> AssessmentAnswers => Set<AssessmentAnswer>();
    public DbSet<StudyPlan> StudyPlans => Set<StudyPlan>();
    public DbSet<StudyPlanGoal> StudyPlanGoals => Set<StudyPlanGoal>();
    public DbSet<StudyDayLog> StudyDayLogs => Set<StudyDayLog>();
    public DbSet<PlanCourse> PlanCourses => Set<PlanCourse>();
    public DbSet<StudySession> StudySessions => Set<StudySession>();
    public DbSet<Artifact> Artifacts => Set<Artifact>();
    public DbSet<UdemyProgress> UdemyProgress => Set<UdemyProgress>();
    public DbSet<Scenario> Scenarios => Set<Scenario>();
    public DbSet<ScenarioStage> ScenarioStages => Set<ScenarioStage>();
    public DbSet<ScenarioRubricPoint> ScenarioRubricPoints => Set<ScenarioRubricPoint>();
    public DbSet<ScenarioRun> ScenarioRuns => Set<ScenarioRun>();
    public DbSet<ScenarioAnswer> ScenarioAnswers => Set<ScenarioAnswer>();
    public DbSet<ScenarioCoverage> ScenarioCoverage => Set<ScenarioCoverage>();
    public DbSet<CoachSettings> CoachSettings => Set<CoachSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Topic>(e =>
        {
            e.Property(t => t.Name).HasMaxLength(100);
            e.HasIndex(t => t.Name).IsUnique();
        });

        modelBuilder.Entity<LearningItem>(e =>
        {
            e.Property(i => i.Title).HasMaxLength(200);
            e.HasIndex(i => new { i.TopicId, i.Title }).IsUnique();
            e.HasOne(i => i.Topic).WithMany(t => t.Items).HasForeignKey(i => i.TopicId);
        });

        modelBuilder.Entity<QuizQuestion>(e =>
        {
            e.HasOne(q => q.LearningItem).WithMany(i => i.Quiz).HasForeignKey(q => q.LearningItemId);
        });

        modelBuilder.Entity<DailyAssignment>(e =>
        {
            e.HasIndex(a => a.Date).IsUnique();
            e.HasOne(a => a.LearningItem).WithMany().HasForeignKey(a => a.LearningItemId);
        });

        modelBuilder.Entity<InterviewQuestion>(e =>
        {
            e.HasOne(q => q.Topic).WithMany().HasForeignKey(q => q.TopicId);
            e.HasIndex(q => new { q.TopicId, q.Level });
        });

        modelBuilder.Entity<AssessmentAttempt>(e =>
        {
            e.HasOne(a => a.Topic).WithMany().HasForeignKey(a => a.TopicId);
            e.HasIndex(a => new { a.TopicId, a.TakenAt });
        });

        modelBuilder.Entity<AssessmentAnswer>(e =>
        {
            e.HasOne(a => a.Attempt).WithMany(t => t.Answers).HasForeignKey(a => a.AttemptId);
            e.HasOne(a => a.Question).WithMany().HasForeignKey(a => a.QuestionId)
                .OnDelete(DeleteBehavior.Restrict); // avoid multiple cascade paths via Topic
        });

        modelBuilder.Entity<StudyPlan>(e =>
        {
            e.Property(p => p.Title).HasMaxLength(200);
        });

        modelBuilder.Entity<StudyPlanGoal>(e =>
        {
            e.HasOne(g => g.Plan).WithMany(p => p.Goals).HasForeignKey(g => g.PlanId);
        });

        modelBuilder.Entity<StudyDayLog>(e =>
        {
            e.HasOne(d => d.Plan).WithMany(p => p.DayLogs).HasForeignKey(d => d.PlanId);
            e.HasIndex(d => new { d.PlanId, d.Date }).IsUnique();
        });

        modelBuilder.Entity<PlanCourse>(e =>
        {
            e.Property(c => c.Title).HasMaxLength(200);
            e.Property(c => c.Instructor).HasMaxLength(100);
            e.Property(c => c.Url).HasMaxLength(500);
            e.HasIndex(c => c.Order).IsUnique();
            // "Exactly one Active course" backed by the database, not just by service code.
            e.HasIndex(c => c.Status).IsUnique().HasFilter("[Status] = 1");
        });

        modelBuilder.Entity<StudySession>(e =>
        {
            e.Property(s => s.Note).HasMaxLength(500);
            e.HasOne(s => s.Course).WithMany(c => c.Sessions).HasForeignKey(s => s.CourseId);
            e.HasIndex(s => new { s.CourseId, s.Date });
        });

        modelBuilder.Entity<Artifact>(e =>
        {
            e.Property(a => a.Title).HasMaxLength(200);
            e.Property(a => a.Url).HasMaxLength(500);
            e.HasOne(a => a.Course).WithMany(c => c.Artifacts).HasForeignKey(a => a.CourseId);
            e.HasIndex(a => a.CourseId);
        });

        modelBuilder.Entity<UdemyProgress>(e =>
        {
            // One row per plan course at most — a sync upserts, it never appends history.
            e.HasOne(p => p.Course).WithOne().HasForeignKey<UdemyProgress>(p => p.CourseId);
            e.HasIndex(p => p.CourseId).IsUnique();
        });

        modelBuilder.Entity<AppSettings>(e =>
        {
            e.Property(s => s.UdemyAccount).HasMaxLength(200);
            e.Property(s => s.UdemyLastError).HasMaxLength(500);
        });

        modelBuilder.Entity<CoachSettings>(e =>
        {
            e.Property(c => c.KeyHint).HasMaxLength(20);
            e.Property(c => c.Model).HasMaxLength(60);
            e.Property(c => c.LastError).HasMaxLength(300);
        });

        modelBuilder.Entity<Scenario>(e =>
        {
            e.Property(s => s.Slug).HasMaxLength(100);
            e.Property(s => s.Title).HasMaxLength(200);
            e.Property(s => s.Domain).HasMaxLength(100);
            e.HasIndex(s => s.Slug).IsUnique();
        });

        modelBuilder.Entity<ScenarioStage>(e =>
        {
            e.Property(s => s.Label).HasMaxLength(200);
            e.HasOne(s => s.Scenario).WithMany(x => x.Stages).HasForeignKey(s => s.ScenarioId);
            e.HasIndex(s => new { s.ScenarioId, s.Order }).IsUnique();
        });

        modelBuilder.Entity<ScenarioRubricPoint>(e =>
        {
            e.Property(p => p.Text).HasMaxLength(500);
            e.Property(p => p.Tag).HasMaxLength(60);
            e.HasOne(p => p.Stage).WithMany(s => s.RubricPoints).HasForeignKey(p => p.StageId);
            e.HasIndex(p => p.Tag); // the weakness view groups by this
        });

        modelBuilder.Entity<ScenarioRun>(e =>
        {
            e.HasOne(r => r.Scenario).WithMany().HasForeignKey(r => r.ScenarioId);
            // "At most one run in progress per scenario" backed by the database, so Start can
            // resume instead of quietly forking a second run. Same trick as IX_PlanCourses_Status.
            e.HasIndex(r => new { r.ScenarioId, r.Status }).IsUnique().HasFilter("[Status] = 0");
        });

        modelBuilder.Entity<ScenarioAnswer>(e =>
        {
            e.Property(a => a.Model).HasMaxLength(60);
            e.Property(a => a.GradeError).HasMaxLength(300);
            e.HasOne(a => a.Run).WithMany(r => r.Answers).HasForeignKey(a => a.RunId);
            // Restrict: Scenario reaches this row through Run and through Stage both.
            e.HasOne(a => a.Stage).WithMany().HasForeignKey(a => a.StageId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(a => new { a.RunId, a.StageId }).IsUnique(); // one row per stage, upserted
        });

        modelBuilder.Entity<ScenarioCoverage>(e =>
        {
            e.Property(c => c.Evidence).HasMaxLength(1000);
            e.HasOne(c => c.Answer).WithMany(a => a.Coverage).HasForeignKey(c => c.AnswerId);
            e.HasOne(c => c.RubricPoint).WithMany().HasForeignKey(c => c.RubricPointId)
                .OnDelete(DeleteBehavior.Restrict); // same multiple-cascade-path problem
            e.HasIndex(c => new { c.AnswerId, c.RubricPointId }).IsUnique();
        });
    }
}
