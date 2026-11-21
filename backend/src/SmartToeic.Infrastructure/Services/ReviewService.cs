using Microsoft.EntityFrameworkCore;
using SmartToeic.Application.DTOs.Reviews;
using SmartToeic.Application.Interfaces;
using SmartToeic.Domain.Entities;
using SmartToeic.Infrastructure.Persistence;

namespace SmartToeic.Infrastructure.Services;

public class ReviewService : IReviewService
{
    private readonly AppDbContext _context;

    public ReviewService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<ReviewDeckSummaryDto> GetDueReviewsAsync(Guid userId, int limit = 20)
    {
        var now = DateTime.UtcNow;
        var safeLimit = Math.Clamp(limit, 1, 100);

        var totalCards = await _context.ReviewCards.CountAsync(c => c.UserId == userId);
        var dueCount = await _context.ReviewCards.CountAsync(c => c.UserId == userId && c.NextReviewDate <= now);
        var masteredCount = await _context.ReviewCards.CountAsync(c => c.UserId == userId && c.IntervalDays >= 21);

        var dueCards = await _context.ReviewCards
            .AsNoTracking()
            .Where(c => c.UserId == userId && c.NextReviewDate <= now)
            .OrderBy(c => c.NextReviewDate)
            .Take(safeLimit)
            .Include(c => c.Question)
                .ThenInclude(q => q.QuestionGroup)
            .Include(c => c.Question)
                .ThenInclude(q => q.QuestionTags)
                    .ThenInclude(qt => qt.KnowledgeTag)
            .ToListAsync();

        return new ReviewDeckSummaryDto
        {
            TotalCards = totalCards,
            DueCount = dueCount,
            MasteredCount = masteredCount,
            DueCards = dueCards.Select(MapToDto).ToList()
        };
    }

    public async Task<SubmitReviewResponse> SubmitReviewAsync(Guid userId, Guid cardId, SubmitReviewRequest request)
    {
        var card = await _context.ReviewCards
            .FirstOrDefaultAsync(c => c.Id == cardId && c.UserId == userId)
            ?? throw new KeyNotFoundException("Không tìm thấy thẻ ôn tập.");

        int q = request.Quality;

        // Công thức lặp lại ngắt quãng SuperMemo-2 (SM-2)
        if (q < 3)
        {
            card.Repetition = 0;
            card.IntervalDays = 1;
        }
        else
        {
            if (card.Repetition == 0)
                card.IntervalDays = 1;
            else if (card.Repetition == 1)
                card.IntervalDays = 6;
            else
                card.IntervalDays = (int)Math.Round(card.IntervalDays * card.EaseFactor, MidpointRounding.AwayFromZero);

            card.Repetition += 1;
        }

        double newEf = card.EaseFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
        card.EaseFactor = Math.Max(1.3, Math.Round(newEf, 2));

        var now = DateTime.UtcNow;
        card.LastReviewedAt = now;
        card.NextReviewDate = now.AddDays(card.IntervalDays);

        await _context.SaveChangesAsync();

        return new SubmitReviewResponse
        {
            CardId = card.Id,
            EaseFactor = card.EaseFactor,
            IntervalDays = card.IntervalDays,
            Repetition = card.Repetition,
            NextReviewDate = card.NextReviewDate,
            LastReviewedAt = now,
            Message = $"Đã lên lịch ôn lại sau {card.IntervalDays} ngày."
        };
    }

    public async Task<ReviewCardDto> BookmarkQuestionAsync(Guid userId, Guid questionId)
    {
        var question = await _context.Questions
            .AsNoTracking()
            .Include(q => q.QuestionGroup)
            .Include(q => q.QuestionTags)
                .ThenInclude(qt => qt.KnowledgeTag)
            .FirstOrDefaultAsync(q => q.Id == questionId)
            ?? throw new KeyNotFoundException("Không tìm thấy câu hỏi.");

        var existing = await _context.ReviewCards
            .FirstOrDefaultAsync(c => c.UserId == userId && c.QuestionId == questionId);

        if (existing == null)
        {
            existing = new ReviewCard
            {
                UserId = userId,
                QuestionId = questionId,
                EaseFactor = 2.5,
                IntervalDays = 0,
                Repetition = 0,
                NextReviewDate = DateTime.UtcNow
            };
            _context.ReviewCards.Add(existing);
            await _context.SaveChangesAsync();
        }

        existing.Question = question;
        return MapToDto(existing);
    }

    public async Task DeleteCardAsync(Guid userId, Guid cardId)
    {
        var card = await _context.ReviewCards
            .FirstOrDefaultAsync(c => c.Id == cardId && c.UserId == userId)
            ?? throw new KeyNotFoundException("Không tìm thấy thẻ ôn tập.");

        _context.ReviewCards.Remove(card);
        await _context.SaveChangesAsync();
    }

    private static ReviewCardDto MapToDto(ReviewCard card) => new()
    {
        CardId = card.Id,
        QuestionId = card.QuestionId,
        PartNumber = card.Question.QuestionGroup.PartNumber,
        QuestionNumber = card.Question.QuestionNumber,
        AudioUrl = card.Question.QuestionGroup.AudioUrl,
        ImageUrl = card.Question.QuestionGroup.ImageUrl,
        PassageHtml = card.Question.QuestionGroup.PassageHtml,
        TranscriptHtml = card.Question.QuestionGroup.TranscriptHtml,
        Content = card.Question.Content,
        OptionA = card.Question.OptionA,
        OptionB = card.Question.OptionB,
        OptionC = card.Question.OptionC,
        OptionD = card.Question.OptionD,
        CorrectOption = card.Question.CorrectOption,
        Explanation = card.Question.Explanation,
        Tags = card.Question.QuestionTags.Select(qt => qt.KnowledgeTag.Name).ToList(),
        EaseFactor = card.EaseFactor,
        IntervalDays = card.IntervalDays,
        Repetition = card.Repetition,
        NextReviewDate = card.NextReviewDate,
        LastReviewedAt = card.LastReviewedAt
    };
}
