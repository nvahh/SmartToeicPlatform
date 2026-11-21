using System.ComponentModel.DataAnnotations;

namespace SmartToeic.Application.DTOs.Reviews;

public class ReviewCardDto
{
    public Guid CardId { get; set; }
    public Guid QuestionId { get; set; }
    public int PartNumber { get; set; }
    public int QuestionNumber { get; set; }
    public string? AudioUrl { get; set; }
    public string? ImageUrl { get; set; }
    public string? PassageHtml { get; set; }
    public string? TranscriptHtml { get; set; }
    public string? Content { get; set; }
    public string? OptionA { get; set; }
    public string? OptionB { get; set; }
    public string? OptionC { get; set; }
    public string? OptionD { get; set; }
    public string CorrectOption { get; set; } = string.Empty;
    public string? Explanation { get; set; }
    public List<string> Tags { get; set; } = new();

    public double EaseFactor { get; set; }
    public int IntervalDays { get; set; }
    public int Repetition { get; set; }
    public DateTime NextReviewDate { get; set; }
    public DateTime? LastReviewedAt { get; set; }
}

public class ReviewDeckSummaryDto
{
    public int TotalCards { get; set; }
    public int DueCount { get; set; }
    public int MasteredCount { get; set; }
    public List<ReviewCardDto> DueCards { get; set; } = new();
}

public class SubmitReviewRequest
{
    // Thang điểm SM-2: 0-2 = Quên/Sai (lặp lại sau 1 ngày), 3 = Nhớ khó, 4 = Nhớ tốt, 5 = Rất dễ
    [Range(0, 5, ErrorMessage = "Mức độ ghi nhớ (quality) phải từ 0 đến 5.")]
    public int Quality { get; set; }
}

public class SubmitReviewResponse
{
    public Guid CardId { get; set; }
    public double EaseFactor { get; set; }
    public int IntervalDays { get; set; }
    public int Repetition { get; set; }
    public DateTime NextReviewDate { get; set; }
    public DateTime LastReviewedAt { get; set; }
    public string Message { get; set; } = string.Empty;
}
