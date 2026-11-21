using Microsoft.EntityFrameworkCore;
using SmartToeic.Domain.Entities;

namespace SmartToeic.Infrastructure.Persistence;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Exam> Exams => Set<Exam>();
    public DbSet<QuestionGroup> QuestionGroups => Set<QuestionGroup>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<KnowledgeTag> KnowledgeTags => Set<KnowledgeTag>();
    public DbSet<QuestionTag> QuestionTags => Set<QuestionTag>();
    public DbSet<ExamAttempt> ExamAttempts => Set<ExamAttempt>();
    public DbSet<UserAnswer> UserAnswers => Set<UserAnswer>();
    public DbSet<ReviewCard> ReviewCards => Set<ReviewCard>();
    public DbSet<ScoreConversion> ScoreConversions => Set<ScoreConversion>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Email).IsRequired().HasMaxLength(150);
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.FullName).IsRequired().HasMaxLength(100);
            e.Property(x => x.Role).HasConversion<string>().HasMaxLength(20);
        });

        modelBuilder.Entity<Exam>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).IsRequired().HasMaxLength(200);
            e.Property(x => x.Source).HasMaxLength(100);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        });

        modelBuilder.Entity<QuestionGroup>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Exam)
                .WithMany(ex => ex.QuestionGroups)
                .HasForeignKey(x => x.ExamId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Question>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.CorrectOption).IsRequired().HasMaxLength(1);
            e.HasOne(x => x.QuestionGroup)
                .WithMany(g => g.Questions)
                .HasForeignKey(x => x.QuestionGroupId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<KnowledgeTag>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).IsRequired().HasMaxLength(100);
            e.HasIndex(x => x.Name).IsUnique();
            e.Property(x => x.Category).IsRequired().HasMaxLength(50);
        });

        modelBuilder.Entity<QuestionTag>(e =>
        {
            e.HasKey(x => new { x.QuestionId, x.KnowledgeTagId });
            e.HasOne(x => x.Question)
                .WithMany(q => q.QuestionTags)
                .HasForeignKey(x => x.QuestionId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.KnowledgeTag)
                .WithMany(t => t.QuestionTags)
                .HasForeignKey(x => x.KnowledgeTagId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ExamAttempt>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Mode).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.SelectedParts).HasMaxLength(30);

            e.HasOne(x => x.User)
                .WithMany(u => u.ExamAttempts)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Exam)
                .WithMany(ex => ex.ExamAttempts)
                .HasForeignKey(x => x.ExamId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<UserAnswer>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.SelectedOption).HasMaxLength(1);
            e.HasIndex(x => new { x.ExamAttemptId, x.QuestionId }).IsUnique();

            e.HasOne(x => x.ExamAttempt)
                .WithMany(a => a.UserAnswers)
                .HasForeignKey(x => x.ExamAttemptId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Question)
                .WithMany(q => q.UserAnswers)
                .HasForeignKey(x => x.QuestionId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ReviewCard>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.UserId, x.QuestionId }).IsUnique();

            e.HasOne(x => x.User)
                .WithMany(u => u.ReviewCards)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Question)
                .WithMany(q => q.ReviewCards)
                .HasForeignKey(x => x.QuestionId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ScoreConversion>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Section).HasConversion<string>().HasMaxLength(20);
            e.HasIndex(x => new { x.Section, x.CorrectCount }).IsUnique();
        });
    }
}