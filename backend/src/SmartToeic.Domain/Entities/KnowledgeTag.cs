namespace SmartToeic.Domain.Entities;

public class KnowledgeTag
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty; // Grammar, Vocab, Listening, Reading
    public string? Description { get; set; }

    public ICollection<QuestionTag> QuestionTags { get; set; } = new List<QuestionTag>();
}