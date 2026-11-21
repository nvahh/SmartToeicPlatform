using Microsoft.EntityFrameworkCore;
using SmartToeic.Application.DTOs.Exams;
using SmartToeic.Application.Interfaces;
using SmartToeic.Domain.Entities;
using SmartToeic.Domain.Enums;
using SmartToeic.Infrastructure.Persistence;

namespace SmartToeic.Infrastructure.Services;

public class ExamService : IExamService
{
    private readonly AppDbContext _context;

    public ExamService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<ExamSummaryDto>> GetExamsAsync(bool isAdmin, string? search, int? year)
    {
        var query = _context.Exams
            .AsNoTracking()
            .Where(e => !e.IsDeleted);

        if (!isAdmin)
            query = query.Where(e => e.Status == ExamStatus.Published);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim().ToLower();
            query = query.Where(e =>
                e.Title.ToLower().Contains(keyword) ||
                (e.Source != null && e.Source.ToLower().Contains(keyword)));
        }

        if (year.HasValue)
            query = query.Where(e => e.Year == year.Value);

        return await query
            .OrderByDescending(e => e.DurationMinutes >= 120)
            .ThenBy(e => e.Year)
            .ThenBy(e => e.Title)
            .Select(e => new ExamSummaryDto
            {
                Id = e.Id,
                Title = e.Title,
                Year = e.Year,
                Source = e.Source,
                DurationMinutes = e.DurationMinutes,
                Status = e.Status.ToString(),
                TotalQuestions = e.QuestionGroups.SelectMany(g => g.Questions).Count(),
                CreatedAt = e.CreatedAt
            })
            .ToListAsync();
    }

    public async Task<ExamDetailDto> GetExamDetailAsync(Guid examId, bool includeAnswers)
    {
        var exam = await _context.Exams
            .AsNoTracking()
            .Include(e => e.QuestionGroups)
                .ThenInclude(g => g.Questions)
                    .ThenInclude(q => q.QuestionTags)
                        .ThenInclude(qt => qt.KnowledgeTag)
            .FirstOrDefaultAsync(e => e.Id == examId && !e.IsDeleted)
            ?? throw new KeyNotFoundException("Không tìm thấy đề thi.");

        if (!includeAnswers && exam.Status != ExamStatus.Published)
            throw new UnauthorizedAccessException("Đề thi này chưa được xuất bản.");

        return new ExamDetailDto
        {
            Id = exam.Id,
            Title = exam.Title,
            Year = exam.Year,
            Source = exam.Source,
            DurationMinutes = exam.DurationMinutes,
            Status = exam.Status.ToString(),
            CreatedAt = exam.CreatedAt,
            QuestionGroups = exam.QuestionGroups
                .OrderBy(g => g.PartNumber)
                .ThenBy(g => g.OrderIndex)
                .Select(g => new QuestionGroupDto
                {
                    Id = g.Id,
                    PartNumber = g.PartNumber,
                    OrderIndex = g.OrderIndex,
                    AudioUrl = g.AudioUrl,
                    ImageUrl = g.ImageUrl,
                    PassageHtml = g.PassageHtml,
                    TranscriptHtml = includeAnswers ? g.TranscriptHtml : null,
                    Questions = g.Questions
                        .OrderBy(q => q.QuestionNumber)
                        .Select(q => new QuestionDto
                        {
                            Id = q.Id,
                            QuestionNumber = q.QuestionNumber,
                            Content = q.Content,
                            OptionA = q.OptionA,
                            OptionB = q.OptionB,
                            OptionC = q.OptionC,
                            OptionD = q.OptionD,
                            CorrectOption = includeAnswers ? q.CorrectOption : null,
                            Explanation = includeAnswers ? q.Explanation : null,
                            DifficultyLevel = q.DifficultyLevel,
                            Tags = q.QuestionTags.Select(qt => qt.KnowledgeTag.Name).ToList()
                        })
                        .ToList()
                })
                .ToList()
        };
    }

    public async Task<ExamSummaryDto> CreateExamAsync(CreateExamRequest request)
    {
        var exam = new Exam
        {
            Title = request.Title.Trim(),
            Year = request.Year,
            Source = request.Source?.Trim(),
            DurationMinutes = request.DurationMinutes,
            Status = ExamStatus.Draft,
            CreatedAt = DateTime.UtcNow
        };

        _context.Exams.Add(exam);
        await _context.SaveChangesAsync();

        return new ExamSummaryDto
        {
            Id = exam.Id,
            Title = exam.Title,
            Year = exam.Year,
            Source = exam.Source,
            DurationMinutes = exam.DurationMinutes,
            Status = exam.Status.ToString(),
            TotalQuestions = 0,
            CreatedAt = exam.CreatedAt
        };
    }

    public async Task<ExamSummaryDto> UpdateExamAsync(Guid examId, UpdateExamRequest request)
    {
        var exam = await _context.Exams
            .Include(e => e.QuestionGroups)
                .ThenInclude(g => g.Questions)
            .FirstOrDefaultAsync(e => e.Id == examId && !e.IsDeleted)
            ?? throw new KeyNotFoundException("Không tìm thấy đề thi.");

        exam.Title = request.Title.Trim();
        exam.Year = request.Year;
        exam.Source = request.Source?.Trim();
        exam.DurationMinutes = request.DurationMinutes;

        await _context.SaveChangesAsync();

        return new ExamSummaryDto
        {
            Id = exam.Id,
            Title = exam.Title,
            Year = exam.Year,
            Source = exam.Source,
            DurationMinutes = exam.DurationMinutes,
            Status = exam.Status.ToString(),
            TotalQuestions = exam.QuestionGroups.SelectMany(g => g.Questions).Count(),
            CreatedAt = exam.CreatedAt
        };
    }

    public async Task UpdateExamStatusAsync(Guid examId, ExamStatus status)
    {
        var exam = await _context.Exams.FirstOrDefaultAsync(e => e.Id == examId && !e.IsDeleted)
            ?? throw new KeyNotFoundException("Không tìm thấy đề thi.");

        exam.Status = status;
        await _context.SaveChangesAsync();
    }

    public async Task SoftDeleteExamAsync(Guid examId)
    {
        var exam = await _context.Exams.FirstOrDefaultAsync(e => e.Id == examId && !e.IsDeleted)
            ?? throw new KeyNotFoundException("Không tìm thấy đề thi.");

        exam.IsDeleted = true;
        await _context.SaveChangesAsync();
    }

    public async Task<QuestionGroupDto> AddQuestionGroupAsync(Guid examId, CreateQuestionGroupRequest request)
    {
        var examExists = await _context.Exams.AnyAsync(e => e.Id == examId && !e.IsDeleted);
        if (!examExists)
            throw new KeyNotFoundException("Không tìm thấy đề thi.");

        var tagMap = await LoadTagDictionaryAsync();
        var group = BuildQuestionGroupEntity(examId, request, tagMap);

        _context.QuestionGroups.Add(group);
        await _context.SaveChangesAsync();

        return new QuestionGroupDto
        {
            Id = group.Id,
            PartNumber = group.PartNumber,
            OrderIndex = group.OrderIndex,
            AudioUrl = group.AudioUrl,
            ImageUrl = group.ImageUrl,
            PassageHtml = group.PassageHtml,
            TranscriptHtml = group.TranscriptHtml,
            Questions = group.Questions
                .OrderBy(q => q.QuestionNumber)
                .Select(q => new QuestionDto
                {
                    Id = q.Id,
                    QuestionNumber = q.QuestionNumber,
                    Content = q.Content,
                    OptionA = q.OptionA,
                    OptionB = q.OptionB,
                    OptionC = q.OptionC,
                    OptionD = q.OptionD,
                    CorrectOption = q.CorrectOption,
                    Explanation = q.Explanation,
                    DifficultyLevel = q.DifficultyLevel,
                    Tags = q.QuestionTags.Select(qt => qt.KnowledgeTag.Name).ToList()
                })
                .ToList()
        };
    }

    public async Task DeleteQuestionGroupAsync(Guid groupId)
    {
        var group = await _context.QuestionGroups.FirstOrDefaultAsync(g => g.Id == groupId)
            ?? throw new KeyNotFoundException("Không tìm thấy nhóm câu hỏi.");

        _context.QuestionGroups.Remove(group);
        await _context.SaveChangesAsync();
    }

    public async Task<QuestionGroupDto> UpdateQuestionGroupMediaAsync(Guid groupId, UpdateQuestionGroupMediaRequest request)
    {
        var group = await _context.QuestionGroups
            .Include(g => g.Questions)
                .ThenInclude(q => q.QuestionTags)
                    .ThenInclude(qt => qt.KnowledgeTag)
            .FirstOrDefaultAsync(g => g.Id == groupId)
            ?? throw new KeyNotFoundException("Không tìm thấy nhóm câu hỏi.");

        group.AudioUrl = string.IsNullOrWhiteSpace(request.AudioUrl) ? null : request.AudioUrl.Trim();
        group.ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim();

        await _context.SaveChangesAsync();

        return new QuestionGroupDto
        {
            Id = group.Id,
            PartNumber = group.PartNumber,
            OrderIndex = group.OrderIndex,
            AudioUrl = group.AudioUrl,
            ImageUrl = group.ImageUrl,
            PassageHtml = group.PassageHtml,
            TranscriptHtml = group.TranscriptHtml,
            Questions = group.Questions
                .OrderBy(q => q.QuestionNumber)
                .Select(q => new QuestionDto
                {
                    Id = q.Id,
                    QuestionNumber = q.QuestionNumber,
                    Content = q.Content,
                    OptionA = q.OptionA,
                    OptionB = q.OptionB,
                    OptionC = q.OptionC,
                    OptionD = q.OptionD,
                    CorrectOption = q.CorrectOption,
                    Explanation = q.Explanation,
                    DifficultyLevel = q.DifficultyLevel,
                    Tags = q.QuestionTags.Select(qt => qt.KnowledgeTag.Name).ToList()
                })
                .ToList()
        };
    }

    public async Task<ExamDetailDto> BulkImportExamAsync(BulkImportExamRequest request)
    {
        var tagMap = await LoadTagDictionaryAsync();

        var exam = new Exam
        {
            Title = request.Title.Trim(),
            Year = request.Year,
            Source = request.Source?.Trim(),
            DurationMinutes = request.DurationMinutes,
            Status = request.PublishImmediately ? ExamStatus.Published : ExamStatus.Draft,
            CreatedAt = DateTime.UtcNow
        };

        foreach (var groupReq in request.QuestionGroups)
        {
            var group = BuildQuestionGroupEntity(exam.Id, groupReq, tagMap);
            exam.QuestionGroups.Add(group);
        }

        _context.Exams.Add(exam);
        await _context.SaveChangesAsync();

        return await GetExamDetailAsync(exam.Id, includeAnswers: true);
    }

    public async Task<List<KnowledgeTagDto>> GetKnowledgeTagsAsync()
    {
        return await _context.KnowledgeTags
            .AsNoTracking()
            .OrderBy(t => t.Category)
            .ThenBy(t => t.Name)
            .Select(t => new KnowledgeTagDto
            {
                Id = t.Id,
                Name = t.Name,
                Category = t.Category,
                Description = t.Description
            })
            .ToListAsync();
    }

    public async Task<KnowledgeTagDto> CreateKnowledgeTagAsync(CreateKnowledgeTagRequest request)
    {
        var normalizedName = request.Name.Trim();
        var exists = await _context.KnowledgeTags.AnyAsync(t => t.Name.ToLower() == normalizedName.ToLower());
        if (exists)
            throw new InvalidOperationException("Thẻ kiến thức này đã tồn tại.");

        var tag = new KnowledgeTag
        {
            Name = normalizedName,
            Category = request.Category.Trim(),
            Description = request.Description?.Trim()
        };

        _context.KnowledgeTags.Add(tag);
        await _context.SaveChangesAsync();

        return new KnowledgeTagDto
        {
            Id = tag.Id,
            Name = tag.Name,
            Category = tag.Category,
            Description = tag.Description
        };
    }

    private async Task<Dictionary<string, KnowledgeTag>> LoadTagDictionaryAsync()
    {
        var existingTags = await _context.KnowledgeTags.ToListAsync();
        return existingTags.ToDictionary(t => t.Name.Trim(), StringComparer.OrdinalIgnoreCase);
    }

    private QuestionGroup BuildQuestionGroupEntity(
        Guid examId,
        CreateQuestionGroupRequest groupReq,
        Dictionary<string, KnowledgeTag> tagMap)
    {
        var group = new QuestionGroup
        {
            ExamId = examId,
            PartNumber = groupReq.PartNumber,
            OrderIndex = groupReq.OrderIndex,
            AudioUrl = groupReq.AudioUrl?.Trim(),
            ImageUrl = groupReq.ImageUrl?.Trim(),
            PassageHtml = groupReq.PassageHtml,
            TranscriptHtml = groupReq.TranscriptHtml
        };

        foreach (var qReq in groupReq.Questions)
        {
            var question = new Question
            {
                QuestionGroupId = group.Id,
                QuestionNumber = qReq.QuestionNumber,
                Content = qReq.Content,
                OptionA = qReq.OptionA,
                OptionB = qReq.OptionB,
                OptionC = qReq.OptionC,
                OptionD = qReq.OptionD,
                CorrectOption = qReq.CorrectOption.Trim().ToUpperInvariant(),
                Explanation = qReq.Explanation,
                DifficultyLevel = qReq.DifficultyLevel
            };

            foreach (var rawTag in qReq.TagNames.Where(t => !string.IsNullOrWhiteSpace(t)).Distinct(StringComparer.OrdinalIgnoreCase))
            {
                var cleanTag = rawTag.Trim();
                if (!tagMap.TryGetValue(cleanTag, out var tagEntity))
                {
                    tagEntity = new KnowledgeTag
                    {
                        Name = cleanTag,
                        Category = groupReq.PartNumber <= 4 ? "Listening" : "Reading"
                    };
                    _context.KnowledgeTags.Add(tagEntity);
                    tagMap[cleanTag] = tagEntity;
                }

                question.QuestionTags.Add(new QuestionTag
                {
                    Question = question,
                    KnowledgeTag = tagEntity
                });
            }

            group.Questions.Add(question);
        }

        return group;
    }
}
