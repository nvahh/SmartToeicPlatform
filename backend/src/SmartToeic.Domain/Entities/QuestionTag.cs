namespace SmartToeic.Domain.Entities;

public class QuestionTag
{
    public Guid QuestionId { get; set; }
    public Guid KnowledgeTagId { get; set; }

    public Question Question { get; set; } = null!;
    public KnowledgeTag KnowledgeTag { get; set; } = null!;
}