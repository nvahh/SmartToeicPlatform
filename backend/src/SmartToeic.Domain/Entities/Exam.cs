using SmartToeic.Domain.Enums;

namespace SmartToeic.Domain.Entities;

public class Exam
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public int? Year { get; set; }
    public string? Source { get; set; }
    public int DurationMinutes { get; set; } = 120;
    public ExamStatus Status { get; set; } = ExamStatus.Draft;
    public bool IsDeleted { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<QuestionGroup> QuestionGroups { get; set; } = new List<QuestionGroup>();
    public ICollection<ExamAttempt> ExamAttempts { get; set; } = new List<ExamAttempt>();
}