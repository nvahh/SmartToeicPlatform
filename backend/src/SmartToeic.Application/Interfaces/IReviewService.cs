using SmartToeic.Application.DTOs.Reviews;

namespace SmartToeic.Application.Interfaces;

public interface IReviewService
{
    Task<ReviewDeckSummaryDto> GetDueReviewsAsync(Guid userId, int limit = 20);
    Task<SubmitReviewResponse> SubmitReviewAsync(Guid userId, Guid cardId, SubmitReviewRequest request);
    Task<ReviewCardDto> BookmarkQuestionAsync(Guid userId, Guid questionId);
    Task DeleteCardAsync(Guid userId, Guid cardId);
}
