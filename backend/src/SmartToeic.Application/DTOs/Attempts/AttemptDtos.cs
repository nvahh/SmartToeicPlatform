using System.ComponentModel.DataAnnotations;
using SmartToeic.Domain.Enums;

namespace SmartToeic.Application.DTOs.Attempts;

public class StartAttemptRequest
{
    [Required]
    public Guid ExamId { get; set; }

    // 0 = FullTest, 1 = Practice
    public ExamMode Mode { get; set; } = ExamMode.FullTest;

    // Chỉ dùng khi Mode = Practice (vd: [5, 7])
    public List<int>? SelectedParts { get; set; }

    // Tùy chọn thời gian làm bài cho chế độ Practice (phút)
    [Range(1, 300)]
    public int? CustomDurationMinutes { get; set; }
}

public class AttemptSessionDto
{
    public Guid AttemptId { get; set; }
    public Guid ExamId { get; set; }
    public string ExamTitle { get; set; } = string.Empty;
    public string Mode { get; set; } = string.Empty;
    public string? SelectedParts { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime StartedAt { get; set; }
    public int RemainingSeconds { get; set; }
    public int TotalQuestions { get; set; }
    public List<AttemptQuestionGroupDto> QuestionGroups { get; set; } = new();
}

public class AttemptQuestionGroupDto
{
    public Guid Id { get; set; }
    public int PartNumber { get; set; }
    public int OrderIndex { get; set; }
    public string? AudioUrl { get; set; }
    public string? ImageUrl { get; set; }
    public string? PassageHtml { get; set; }
    public List<AttemptQuestionDto> Questions { get; set; } = new();
}

public class AttemptQuestionDto
{
    public Guid Id { get; set; }
    public int QuestionNumber { get; set; }
    public string? Content { get; set; }
    public string? OptionA { get; set; }
    public string? OptionB { get; set; }
    public string? OptionC { get; set; }
    public string? OptionD { get; set; }
    public string? SelectedOption { get; set; }
    public bool IsFlagged { get; set; }
    public int TimeSpentSeconds { get; set; }
}

public class SaveAnswerItemRequest
{
    [Required]
    public Guid QuestionId { get; set; }

    [RegularExpression("^[A-Da-d]?$", ErrorMessage = "Đáp án chọn phải là A, B, C, D hoặc rỗng.")]
    public string? SelectedOption { get; set; }

    public bool IsFlagged { get; set; }

    [Range(0, 36000)]
    public int TimeSpentSeconds { get; set; }
}

public class SaveAnswersBatchRequest
{
    [Range(0, 36000)]
    public int? RemainingSeconds { get; set; }

    [Required]
    public List<SaveAnswerItemRequest> Answers { get; set; } = new();
}

public class SubmitAttemptRequest
{
    [Range(0, 36000)]
    public int? RemainingSeconds { get; set; }

    public List<SaveAnswerItemRequest>? Answers { get; set; }
}

public class AttemptSummaryDto
{
    public Guid Id { get; set; }
    public Guid ExamId { get; set; }
    public string ExamTitle { get; set; } = string.Empty;
    public string Mode { get; set; } = string.Empty;
    public string? SelectedParts { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime StartedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public int ListeningCorrect { get; set; }
    public int ReadingCorrect { get; set; }
    public int ListeningScore { get; set; }
    public int ReadingScore { get; set; }
    public int TotalScore { get; set; }
}

public class PartStatDto
{
    public int PartNumber { get; set; }
    public int TotalQuestions { get; set; }
    public int CorrectCount { get; set; }
    public double AccuracyPercent { get; set; }
}

public class TagStatDto
{
    public string TagName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int TotalQuestions { get; set; }
    public int CorrectCount { get; set; }
    public double AccuracyPercent { get; set; }
}

public class AttemptResultQuestionDto
{
    public Guid Id { get; set; }
    public int QuestionNumber { get; set; }
    public string? Content { get; set; }
    public string? OptionA { get; set; }
    public string? OptionB { get; set; }
    public string? OptionC { get; set; }
    public string? OptionD { get; set; }
    public string? SelectedOption { get; set; }
    public string CorrectOption { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public bool IsFlagged { get; set; }
    public int TimeSpentSeconds { get; set; }
    public string? Explanation { get; set; }
    public List<string> Tags { get; set; } = new();
}

public class AttemptResultGroupDto
{
    public Guid Id { get; set; }
    public int PartNumber { get; set; }
    public int OrderIndex { get; set; }
    public string? AudioUrl { get; set; }
    public string? ImageUrl { get; set; }
    public string? PassageHtml { get; set; }
    public string? TranscriptHtml { get; set; }
    public List<AttemptResultQuestionDto> Questions { get; set; } = new();
}

public class AttemptResultDto
{
    public Guid AttemptId { get; set; }
    public Guid ExamId { get; set; }
    public string ExamTitle { get; set; } = string.Empty;
    public string Mode { get; set; } = string.Empty;
    public string? SelectedParts { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public int TotalQuestions { get; set; }
    public int CorrectCount { get; set; }
    public int WrongCount { get; set; }
    public int SkippedCount { get; set; }
    public int ListeningCorrect { get; set; }
    public int ReadingCorrect { get; set; }
    public int ListeningScore { get; set; }
    public int ReadingScore { get; set; }
    public int TotalScore { get; set; }
    public int NewReviewCardsQueued { get; set; }
    public List<PartStatDto> PartBreakdown { get; set; } = new();
    public List<TagStatDto> TagBreakdown { get; set; } = new();
    public List<AttemptResultGroupDto> QuestionGroups { get; set; } = new();
}
