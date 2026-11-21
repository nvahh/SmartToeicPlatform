namespace SmartToeic.Domain.Entities;

public class QuestionGroup
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ExamId { get; set; }
    public int PartNumber { get; set; } // 1 -> 7
    public int OrderIndex { get; set; }
    public string? AudioUrl { get; set; }
    public string? ImageUrl { get; set; }
    public string? PassageHtml { get; set; }
    public string? TranscriptHtml { get; set; }

    public Exam Exam { get; set; } = null!;
    public ICollection<Question> Questions { get; set; } = new List<Question>();
}