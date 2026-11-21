using SmartToeic.Application.DTOs.Exams;
using SmartToeic.Domain.Enums;

namespace SmartToeic.Application.Interfaces;

public interface IExamService
{
    Task<List<ExamSummaryDto>> GetExamsAsync(bool isAdmin, string? search, int? year);
    Task<ExamDetailDto> GetExamDetailAsync(Guid examId, bool includeAnswers);
    Task<ExamSummaryDto> CreateExamAsync(CreateExamRequest request);
    Task<ExamSummaryDto> UpdateExamAsync(Guid examId, UpdateExamRequest request);
    Task UpdateExamStatusAsync(Guid examId, ExamStatus status);
    Task SoftDeleteExamAsync(Guid examId);
    Task<QuestionGroupDto> AddQuestionGroupAsync(Guid examId, CreateQuestionGroupRequest request);
    Task DeleteQuestionGroupAsync(Guid groupId);
    Task<QuestionGroupDto> UpdateQuestionGroupMediaAsync(Guid groupId, UpdateQuestionGroupMediaRequest request);
    Task<ExamDetailDto> BulkImportExamAsync(BulkImportExamRequest request);
    Task<List<KnowledgeTagDto>> GetKnowledgeTagsAsync();
    Task<KnowledgeTagDto> CreateKnowledgeTagAsync(CreateKnowledgeTagRequest request);
}
