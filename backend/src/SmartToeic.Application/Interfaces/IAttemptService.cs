using SmartToeic.Application.DTOs.Attempts;

namespace SmartToeic.Application.Interfaces;

public interface IAttemptService
{
    Task<AttemptSessionDto> StartAttemptAsync(Guid userId, StartAttemptRequest request);
    Task<AttemptSessionDto> GetAttemptSessionAsync(Guid userId, Guid attemptId);
    Task SaveAnswersAsync(Guid userId, Guid attemptId, SaveAnswersBatchRequest request);
    Task<AttemptResultDto> SubmitAttemptAsync(Guid userId, Guid attemptId, SubmitAttemptRequest? request);
    Task<AttemptResultDto> GetAttemptResultAsync(Guid userId, Guid attemptId);
    Task<List<AttemptSummaryDto>> GetMyAttemptsAsync(Guid userId);
}
