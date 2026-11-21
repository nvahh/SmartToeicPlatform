using SmartToeic.Domain.Enums;

namespace SmartToeic.Domain.Entities;

public class ExamAttempt
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid ExamId { get; set; }
    public ExamMode Mode { get; set; } = ExamMode.FullTest;
    public string? SelectedParts { get; set; } // Vd: "1,2,5" nếu là Practice
    public AttemptStatus Status { get; set; } = AttemptStatus.InProgress;
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SubmittedAt { get; set; }
    public int RemainingSeconds { get; set; }

    public int ListeningCorrect { get; set; }
    public int ReadingCorrect { get; set; }
    public int ListeningScore { get; set; }
    public int ReadingScore { get; set; }
    public int TotalScore { get; set; }

    public User User { get; set; } = null!;
    public Exam Exam { get; set; } = null!;
    public ICollection<UserAnswer> UserAnswers { get; set; } = new List<UserAnswer>();
}