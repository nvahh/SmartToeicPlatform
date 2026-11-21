namespace SmartToeic.Domain.Entities;

public class Question
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid QuestionGroupId { get; set; }
    public int QuestionNumber { get; set; } // 1 -> 200
    public string? Content { get; set; }
    public string? OptionA { get; set; }
    public string? OptionB { get; set; }
    public string? OptionC { get; set; }
    public string? OptionD { get; set; } // Part 2 để null
    public string CorrectOption { get; set; } = string.Empty; // "A", "B", "C", "D"
    public string? Explanation { get; set; }

    // Các trường dự trù cho giai đoạn AI Adaptive (ĐATN)
    public int DifficultyLevel { get; set; } = 3; // 1 -> 5
    public double? IrtDifficulty { get; set; }

    public QuestionGroup QuestionGroup { get; set; } = null!;
    public ICollection<QuestionTag> QuestionTags { get; set; } = new List<QuestionTag>();
    public ICollection<UserAnswer> UserAnswers { get; set; } = new List<UserAnswer>();
    public ICollection<ReviewCard> ReviewCards { get; set; } = new List<ReviewCard>();
}