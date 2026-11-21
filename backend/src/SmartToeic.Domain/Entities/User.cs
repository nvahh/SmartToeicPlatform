using SmartToeic.Domain.Enums;

namespace SmartToeic.Domain.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Learner;
    public int? TargetScore { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ExamAttempt> ExamAttempts { get; set; } = new List<ExamAttempt>();
    public ICollection<ReviewCard> ReviewCards { get; set; } = new List<ReviewCard>();
}