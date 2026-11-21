namespace SmartToeic.Domain.Entities;

public class UserAnswer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ExamAttemptId { get; set; }
    public Guid QuestionId { get; set; }
    public string? SelectedOption { get; set; } // "A", "B", "C", "D" hoặc null nếu bỏ trống
    public bool IsCorrect { get; set; }
    public bool IsFlagged { get; set; }
    public int TimeSpentSeconds { get; set; } // Dự trù cho AI

    public ExamAttempt ExamAttempt { get; set; } = null!;
    public Question Question { get; set; } = null!;
}