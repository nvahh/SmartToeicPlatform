using System.ComponentModel.DataAnnotations;
using SmartToeic.Domain.Enums;

namespace SmartToeic.Application.DTOs.Exams;

public class ExamSummaryDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public int? Year { get; set; }
    public string? Source { get; set; }
    public int DurationMinutes { get; set; }
    public string Status { get; set; } = string.Empty;
    public int TotalQuestions { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ExamDetailDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public int? Year { get; set; }
    public string? Source { get; set; }
    public int DurationMinutes { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public List<QuestionGroupDto> QuestionGroups { get; set; } = new();
}

public class QuestionGroupDto
{
    public Guid Id { get; set; }
    public int PartNumber { get; set; }
    public int OrderIndex { get; set; }
    public string? AudioUrl { get; set; }
    public string? ImageUrl { get; set; }
    public string? PassageHtml { get; set; }
    public string? TranscriptHtml { get; set; }
    public List<QuestionDto> Questions { get; set; } = new();
}

public class QuestionDto
{
    public Guid Id { get; set; }
    public int QuestionNumber { get; set; }
    public string? Content { get; set; }
    public string? OptionA { get; set; }
    public string? OptionB { get; set; }
    public string? OptionC { get; set; }
    public string? OptionD { get; set; }
    public string? CorrectOption { get; set; }
    public string? Explanation { get; set; }
    public int DifficultyLevel { get; set; }
    public List<string> Tags { get; set; } = new();
}

public class CreateExamRequest
{
    [Required(ErrorMessage = "Tiêu đề đề thi không được để trống.")]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Range(2000, 2100)]
    public int? Year { get; set; }

    [MaxLength(100)]
    public string? Source { get; set; }

    [Range(1, 300)]
    public int DurationMinutes { get; set; } = 120;
}

public class UpdateExamRequest : CreateExamRequest { }

public class UpdateExamStatusRequest
{
    [Required]
    public ExamStatus Status { get; set; }
}

public class CreateQuestionGroupRequest
{
    [Range(1, 7, ErrorMessage = "PartNumber phải từ 1 đến 7.")]
    public int PartNumber { get; set; }

    public int OrderIndex { get; set; } = 1;
    public string? AudioUrl { get; set; }
    public string? ImageUrl { get; set; }
    public string? PassageHtml { get; set; }
    public string? TranscriptHtml { get; set; }

    [Required]
    [MinLength(1, ErrorMessage = "Nhóm câu hỏi phải có ít nhất 1 câu hỏi.")]
    public List<CreateQuestionRequest> Questions { get; set; } = new();
}

public class CreateQuestionRequest
{
    [Range(1, 200, ErrorMessage = "Số thứ tự câu hỏi phải từ 1 đến 200.")]
    public int QuestionNumber { get; set; }

    public string? Content { get; set; }
    public string? OptionA { get; set; }
    public string? OptionB { get; set; }
    public string? OptionC { get; set; }
    public string? OptionD { get; set; }

    [Required]
    [RegularExpression("^[A-Da-d]$", ErrorMessage = "Đáp án đúng phải là A, B, C hoặc D.")]
    public string CorrectOption { get; set; } = "A";

    public string? Explanation { get; set; }

    [Range(1, 5)]
    public int DifficultyLevel { get; set; } = 3;

    public List<string> TagNames { get; set; } = new();
}

public class BulkImportExamRequest : CreateExamRequest
{
    public bool PublishImmediately { get; set; } = true;

    [Required]
    [MinLength(1, ErrorMessage = "Đề thi import phải có ít nhất 1 nhóm câu hỏi.")]
    public List<CreateQuestionGroupRequest> QuestionGroups { get; set; } = new();
}

public class KnowledgeTagDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class CreateKnowledgeTagRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Category { get; set; } = "Grammar";

    public string? Description { get; set; }
}
public class UpdateQuestionGroupMediaRequest
{
    public string? AudioUrl { get; set; }
    public string? ImageUrl { get; set; }
}