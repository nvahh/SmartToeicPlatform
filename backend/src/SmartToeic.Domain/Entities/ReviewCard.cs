namespace SmartToeic.Domain.Entities;

public class ReviewCard
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid QuestionId { get; set; }

    // Tham số thuật toán lặp lại ngắt quãng SM-2
    public double EaseFactor { get; set; } = 2.5;
    public int IntervalDays { get; set; } = 0;
    public int Repetition { get; set; } = 0;
    public DateTime NextReviewDate { get; set; } = DateTime.UtcNow;
    public DateTime? LastReviewedAt { get; set; }

    public User User { get; set; } = null!;
    public Question Question { get; set; } = null!;
}