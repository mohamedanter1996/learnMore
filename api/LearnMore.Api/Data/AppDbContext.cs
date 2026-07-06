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
    }
}
