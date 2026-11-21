using Microsoft.EntityFrameworkCore;
using SmartToeic.Application.DTOs.Attempts;
using SmartToeic.Application.Interfaces;
using SmartToeic.Domain.Entities;
using SmartToeic.Domain.Enums;
using SmartToeic.Infrastructure.Persistence;

namespace SmartToeic.Infrastructure.Services;

public class AttemptService : IAttemptService
{
    private readonly AppDbContext _context;

    public AttemptService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<AttemptSessionDto> StartAttemptAsync(Guid userId, StartAttemptRequest request)
    {
        var exam = await _context.Exams
            .AsNoTracking()
            .Include(e => e.QuestionGroups)
                .ThenInclude(g => g.Questions)
            .FirstOrDefaultAsync(e => e.Id == request.ExamId && !e.IsDeleted)
            ?? throw new KeyNotFoundException("Không tìm thấy đề thi.");

        if (exam.Status != ExamStatus.Published)
            throw new InvalidOperationException("Đề thi này chưa được xuất bản.");

        HashSet<int>? partFilter = null;
        string? selectedPartsStr = null;

        if (request.Mode == ExamMode.Practice)
        {
            if (request.SelectedParts == null || request.SelectedParts.Count == 0)
                throw new InvalidOperationException("Chế độ Practice cần chọn ít nhất 1 Part (từ 1 đến 7).");

            var validParts = request.SelectedParts
                .Where(p => p is >= 1 and <= 7)
                .Distinct()
                .OrderBy(p => p)
                .ToList();

            if (validParts.Count == 0)
                throw new InvalidOperationException("Danh sách Part không hợp lệ (chỉ nhận 1 đến 7).");

            partFilter = validParts.ToHashSet();
            selectedPartsStr = string.Join(",", validParts);
        }

        var groups = FilterAndOrderGroups(exam.QuestionGroups, partFilter);
        var totalQuestions = groups.Sum(g => g.Questions.Count);
        if (totalQuestions == 0)
            throw new InvalidOperationException("Không có câu hỏi nào thuộc các Part đã chọn.");

        var durationMinutes = request.Mode == ExamMode.Practice && request.CustomDurationMinutes.HasValue
            ? request.CustomDurationMinutes.Value
            : exam.DurationMinutes;

        var attempt = new ExamAttempt
        {
            UserId = userId,
            ExamId = exam.Id,
            Mode = request.Mode,
            SelectedParts = selectedPartsStr,
            Status = AttemptStatus.InProgress,
            StartedAt = DateTime.UtcNow,
            RemainingSeconds = durationMinutes * 60
        };

        _context.ExamAttempts.Add(attempt);
        await _context.SaveChangesAsync();

        return BuildSessionDto(attempt, exam.Title, groups, new Dictionary<Guid, UserAnswer>());
    }

    public async Task<AttemptSessionDto> GetAttemptSessionAsync(Guid userId, Guid attemptId)
    {
        var attempt = await _context.ExamAttempts
            .AsNoTracking()
            .Include(a => a.UserAnswers)
            .Include(a => a.Exam)
                .ThenInclude(e => e.QuestionGroups)
                    .ThenInclude(g => g.Questions)
            .FirstOrDefaultAsync(a => a.Id == attemptId && a.UserId == userId)
            ?? throw new KeyNotFoundException("Không tìm thấy phiên làm bài.");

        if (attempt.Status != AttemptStatus.InProgress)
            throw new InvalidOperationException("Phiên làm bài này đã kết thúc. Vui lòng xem ở trang kết quả.");

        var partFilter = ParseSelectedParts(attempt.SelectedParts);
        var groups = FilterAndOrderGroups(attempt.Exam.QuestionGroups, partFilter);
        var answerMap = attempt.UserAnswers.ToDictionary(ua => ua.QuestionId);

        return BuildSessionDto(attempt, attempt.Exam.Title, groups, answerMap);
    }

    public async Task SaveAnswersAsync(Guid userId, Guid attemptId, SaveAnswersBatchRequest request)
    {
        var attempt = await _context.ExamAttempts
            .Include(a => a.UserAnswers)
            .FirstOrDefaultAsync(a => a.Id == attemptId && a.UserId == userId)
            ?? throw new KeyNotFoundException("Không tìm thấy phiên làm bài.");

        if (attempt.Status != AttemptStatus.InProgress)
            throw new InvalidOperationException("Bài thi đã nộp, không thể lưu thêm đáp án.");

        if (request.RemainingSeconds.HasValue)
            attempt.RemainingSeconds = Math.Max(0, request.RemainingSeconds.Value);

        await UpsertAnswersAsync(attempt, request.Answers);
        await _context.SaveChangesAsync();
    }

    public async Task<AttemptResultDto> SubmitAttemptAsync(Guid userId, Guid attemptId, SubmitAttemptRequest? request)
    {
        var attempt = await _context.ExamAttempts
            .Include(a => a.UserAnswers)
            .Include(a => a.Exam)
                .ThenInclude(e => e.QuestionGroups)
                    .ThenInclude(g => g.Questions)
                        .ThenInclude(q => q.QuestionTags)
                            .ThenInclude(qt => qt.KnowledgeTag)
            .FirstOrDefaultAsync(a => a.Id == attemptId && a.UserId == userId)
            ?? throw new KeyNotFoundException("Không tìm thấy phiên làm bài.");

        if (attempt.Status == AttemptStatus.Completed)
            throw new InvalidOperationException("Bài thi này đã được nộp trước đó.");

        if (request?.RemainingSeconds.HasValue == true)
            attempt.RemainingSeconds = Math.Max(0, request.RemainingSeconds.Value);

        if (request?.Answers != null && request.Answers.Count > 0)
            await UpsertAnswersAsync(attempt, request.Answers);

        var partFilter = ParseSelectedParts(attempt.SelectedParts);
        var groups = FilterAndOrderGroups(attempt.Exam.QuestionGroups, partFilter);
        var answerMap = attempt.UserAnswers.ToDictionary(ua => ua.QuestionId);

        int listeningCorrect = 0;
        int readingCorrect = 0;
        var wrongQuestionIds = new List<Guid>();

        foreach (var group in groups)
        {
            foreach (var question in group.Questions)
            {
                if (!answerMap.TryGetValue(question.Id, out var userAnswer))
                {
                    userAnswer = new UserAnswer
                    {
                        ExamAttemptId = attempt.Id,
                        QuestionId = question.Id,
                        SelectedOption = null,
                        IsCorrect = false,
                        IsFlagged = false,
                        TimeSpentSeconds = 0
                    };
                    _context.UserAnswers.Add(userAnswer);
                    answerMap[question.Id] = userAnswer;
                }

                userAnswer.IsCorrect = !string.IsNullOrEmpty(userAnswer.SelectedOption) &&
                    userAnswer.SelectedOption.Equals(question.CorrectOption, StringComparison.OrdinalIgnoreCase);

                if (userAnswer.IsCorrect)
                {
                    if (group.PartNumber <= 4) listeningCorrect++;
                    else readingCorrect++;
                }
                else
                {
                    wrongQuestionIds.Add(question.Id);
                }
            }
        }

        // Quy đổi điểm theo bảng ScoreConversions (thang 5 - 495 cho mỗi kỹ năng)
        int clampedLc = Math.Clamp(listeningCorrect, 0, 100);
        int clampedRc = Math.Clamp(readingCorrect, 0, 100);

        var conversions = await _context.ScoreConversions
            .AsNoTracking()
            .Where(s =>
                (s.Section == ToeicSection.Listening && s.CorrectCount == clampedLc) ||
                (s.Section == ToeicSection.Reading && s.CorrectCount == clampedRc))
            .ToListAsync();

        int listeningScore = conversions.FirstOrDefault(s => s.Section == ToeicSection.Listening)?.ScaledScore ?? 5;
        int readingScore = conversions.FirstOrDefault(s => s.Section == ToeicSection.Reading)?.ScaledScore ?? 5;

        attempt.ListeningCorrect = listeningCorrect;
        attempt.ReadingCorrect = readingCorrect;
        attempt.ListeningScore = listeningScore;
        attempt.ReadingScore = readingScore;
        attempt.TotalScore = listeningScore + readingScore;
        attempt.Status = AttemptStatus.Completed;
        attempt.SubmittedAt = DateTime.UtcNow;

        // Tự động đưa các câu làm sai/bỏ trống vào hàng đợi ôn tập SM-2 (ReviewCards)
        int queuedCardsCount = 0;
        if (wrongQuestionIds.Count > 0)
        {
            var existingCards = await _context.ReviewCards
                .Where(c => c.UserId == userId && wrongQuestionIds.Contains(c.QuestionId))
                .ToDictionaryAsync(c => c.QuestionId);

            var now = DateTime.UtcNow;
            foreach (var qId in wrongQuestionIds.Distinct())
            {
                if (existingCards.TryGetValue(qId, out var existingCard))
                {
                    // Làm sai lại câu cũ -> đưa về ôn ngay hôm nay
                    existingCard.Repetition = 0;
                    existingCard.IntervalDays = 1;
                    existingCard.NextReviewDate = now;
                    queuedCardsCount++;
                }
                else
                {
                    _context.ReviewCards.Add(new ReviewCard
                    {
                        UserId = userId,
                        QuestionId = qId,
                        EaseFactor = 2.5,
                        IntervalDays = 0,
                        Repetition = 0,
                        NextReviewDate = now
                    });
                    queuedCardsCount++;
                }
            }
        }

        await _context.SaveChangesAsync();

        var result = BuildResultDto(attempt, groups, answerMap);
        result.NewReviewCardsQueued = queuedCardsCount;
        return result;
    }

    public async Task<AttemptResultDto> GetAttemptResultAsync(Guid userId, Guid attemptId)
    {
        var attempt = await _context.ExamAttempts
            .AsNoTracking()
            .Include(a => a.UserAnswers)
            .Include(a => a.Exam)
                .ThenInclude(e => e.QuestionGroups)
                    .ThenInclude(g => g.Questions)
                        .ThenInclude(q => q.QuestionTags)
                            .ThenInclude(qt => qt.KnowledgeTag)
            .FirstOrDefaultAsync(a => a.Id == attemptId && a.UserId == userId)
            ?? throw new KeyNotFoundException("Không tìm thấy bài thi.");

        if (attempt.Status != AttemptStatus.Completed)
            throw new InvalidOperationException("Bài thi chưa được nộp nên chưa có kết quả.");

        var partFilter = ParseSelectedParts(attempt.SelectedParts);
        var groups = FilterAndOrderGroups(attempt.Exam.QuestionGroups, partFilter);
        var answerMap = attempt.UserAnswers.ToDictionary(ua => ua.QuestionId);

        return BuildResultDto(attempt, groups, answerMap);
    }

    public async Task<List<AttemptSummaryDto>> GetMyAttemptsAsync(Guid userId)
    {
        return await _context.ExamAttempts
            .AsNoTracking()
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.StartedAt)
            .Select(a => new AttemptSummaryDto
            {
                Id = a.Id,
                ExamId = a.ExamId,
                ExamTitle = a.Exam.Title,
                Mode = a.Mode.ToString(),
                SelectedParts = a.SelectedParts,
                Status = a.Status.ToString(),
                StartedAt = a.StartedAt,
                SubmittedAt = a.SubmittedAt,
                ListeningCorrect = a.ListeningCorrect,
                ReadingCorrect = a.ReadingCorrect,
                ListeningScore = a.ListeningScore,
                ReadingScore = a.ReadingScore,
                TotalScore = a.TotalScore
            })
            .ToListAsync();
    }

    private async Task UpsertAnswersAsync(ExamAttempt attempt, List<SaveAnswerItemRequest> answers)
    {
        if (answers.Count == 0) return;

        var validQuestionIds = await _context.Questions
            .AsNoTracking()
            .Where(q => q.QuestionGroup.ExamId == attempt.ExamId)
            .Select(q => q.Id)
            .ToHashSetAsync();

        var existingMap = attempt.UserAnswers.ToDictionary(ua => ua.QuestionId);

        foreach (var item in answers)
        {
            if (!validQuestionIds.Contains(item.QuestionId))
                continue;

            var normalizedOption = string.IsNullOrWhiteSpace(item.SelectedOption)
                ? null
                : item.SelectedOption.Trim().ToUpperInvariant();

            if (existingMap.TryGetValue(item.QuestionId, out var existing))
            {
                existing.SelectedOption = normalizedOption;
                existing.IsFlagged = item.IsFlagged;
                if (item.TimeSpentSeconds > 0)
                    existing.TimeSpentSeconds = item.TimeSpentSeconds;
            }
            else
            {
                var newAnswer = new UserAnswer
                {
                    ExamAttemptId = attempt.Id,
                    QuestionId = item.QuestionId,
                    SelectedOption = normalizedOption,
                    IsFlagged = item.IsFlagged,
                    TimeSpentSeconds = Math.Max(0, item.TimeSpentSeconds),
                    IsCorrect = false
                };
                _context.UserAnswers.Add(newAnswer);
                existingMap[item.QuestionId] = newAnswer;
            }
        }
    }

    private static List<QuestionGroup> FilterAndOrderGroups(
        ICollection<QuestionGroup> groups,
        HashSet<int>? partFilter)
    {
        return groups
            .Where(g => partFilter == null || partFilter.Contains(g.PartNumber))
            .OrderBy(g => g.PartNumber)
            .ThenBy(g => g.OrderIndex)
            .ToList();
    }

    private static HashSet<int>? ParseSelectedParts(string? selectedParts)
    {
        if (string.IsNullOrWhiteSpace(selectedParts)) return null;
        var set = selectedParts
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => int.TryParse(s.Trim(), out var p) ? p : -1)
            .Where(p => p is >= 1 and <= 7)
            .ToHashSet();
        return set.Count > 0 ? set : null;
    }

    private static AttemptSessionDto BuildSessionDto(
        ExamAttempt attempt,
        string examTitle,
        List<QuestionGroup> groups,
        Dictionary<Guid, UserAnswer> answerMap)
    {
        return new AttemptSessionDto
        {
            AttemptId = attempt.Id,
            ExamId = attempt.ExamId,
            ExamTitle = examTitle,
            Mode = attempt.Mode.ToString(),
            SelectedParts = attempt.SelectedParts,
            Status = attempt.Status.ToString(),
            StartedAt = attempt.StartedAt,
            RemainingSeconds = attempt.RemainingSeconds,
            TotalQuestions = groups.Sum(g => g.Questions.Count),
            QuestionGroups = groups.Select(g => new AttemptQuestionGroupDto
            {
                Id = g.Id,
                PartNumber = g.PartNumber,
                OrderIndex = g.OrderIndex,
                AudioUrl = g.AudioUrl,
                ImageUrl = g.ImageUrl,
                PassageHtml = g.PassageHtml,
                Questions = g.Questions
                    .OrderBy(q => q.QuestionNumber)
                    .Select(q =>
                    {
                        answerMap.TryGetValue(q.Id, out var ans);
                        return new AttemptQuestionDto
                        {
                            Id = q.Id,
                            QuestionNumber = q.QuestionNumber,
                            Content = q.Content,
                            OptionA = q.OptionA,
                            OptionB = q.OptionB,
                            OptionC = q.OptionC,
                            OptionD = q.OptionD,
                            SelectedOption = ans?.SelectedOption,
                            IsFlagged = ans?.IsFlagged ?? false,
                            TimeSpentSeconds = ans?.TimeSpentSeconds ?? 0
                        };
                    })
                    .ToList()
            }).ToList()
        };
    }

    private static AttemptResultDto BuildResultDto(
        ExamAttempt attempt,
        List<QuestionGroup> groups,
        Dictionary<Guid, UserAnswer> answerMap)
    {
        int totalQuestions = 0;
        int correctCount = 0;
        int skippedCount = 0;
        var partStats = new Dictionary<int, (int Total, int Correct)>();
        var tagStats = new Dictionary<string, (string Category, int Total, int Correct)>(StringComparer.OrdinalIgnoreCase);

        var resultGroups = new List<AttemptResultGroupDto>();

        foreach (var g in groups)
        {
            var groupDto = new AttemptResultGroupDto
            {
                Id = g.Id,
                PartNumber = g.PartNumber,
                OrderIndex = g.OrderIndex,
                AudioUrl = g.AudioUrl,
                ImageUrl = g.ImageUrl,
                PassageHtml = g.PassageHtml,
                TranscriptHtml = g.TranscriptHtml
            };

            foreach (var q in g.Questions.OrderBy(x => x.QuestionNumber))
            {
                answerMap.TryGetValue(q.Id, out var ans);
                var selected = ans?.SelectedOption;
                var isCorrect = ans?.IsCorrect ?? false;

                totalQuestions++;
                if (isCorrect) correctCount++;
                if (string.IsNullOrEmpty(selected)) skippedCount++;

                partStats.TryGetValue(g.PartNumber, out var pStat);
                partStats[g.PartNumber] = (pStat.Total + 1, pStat.Correct + (isCorrect ? 1 : 0));

                var tagNames = new List<string>();
                foreach (var qt in q.QuestionTags)
                {
                    var tagName = qt.KnowledgeTag.Name;
                    tagNames.Add(tagName);
                    tagStats.TryGetValue(tagName, out var tStat);
                    tagStats[tagName] = (qt.KnowledgeTag.Category, tStat.Total + 1, tStat.Correct + (isCorrect ? 1 : 0));
                }

                groupDto.Questions.Add(new AttemptResultQuestionDto
                {
                    Id = q.Id,
                    QuestionNumber = q.QuestionNumber,
                    Content = q.Content,
                    OptionA = q.OptionA,
                    OptionB = q.OptionB,
                    OptionC = q.OptionC,
                    OptionD = q.OptionD,
                    SelectedOption = selected,
                    CorrectOption = q.CorrectOption,
                    IsCorrect = isCorrect,
                    IsFlagged = ans?.IsFlagged ?? false,
                    TimeSpentSeconds = ans?.TimeSpentSeconds ?? 0,
                    Explanation = q.Explanation,
                    Tags = tagNames
                });
            }

            resultGroups.Add(groupDto);
        }

        return new AttemptResultDto
        {
            AttemptId = attempt.Id,
            ExamId = attempt.ExamId,
            ExamTitle = attempt.Exam.Title,
            Mode = attempt.Mode.ToString(),
            SelectedParts = attempt.SelectedParts,
            StartedAt = attempt.StartedAt,
            SubmittedAt = attempt.SubmittedAt,
            TotalQuestions = totalQuestions,
            CorrectCount = correctCount,
            WrongCount = totalQuestions - correctCount - skippedCount,
            SkippedCount = skippedCount,
            ListeningCorrect = attempt.ListeningCorrect,
            ReadingCorrect = attempt.ReadingCorrect,
            ListeningScore = attempt.ListeningScore,
            ReadingScore = attempt.ReadingScore,
            TotalScore = attempt.TotalScore,
            PartBreakdown = partStats
                .OrderBy(kv => kv.Key)
                .Select(kv => new PartStatDto
                {
                    PartNumber = kv.Key,
                    TotalQuestions = kv.Value.Total,
                    CorrectCount = kv.Value.Correct,
                    AccuracyPercent = kv.Value.Total == 0 ? 0 : Math.Round(kv.Value.Correct * 100.0 / kv.Value.Total, 1)
                })
                .ToList(),
            TagBreakdown = tagStats
                .Select(kv => new TagStatDto
                {
                    TagName = kv.Key,
                    Category = kv.Value.Category,
                    TotalQuestions = kv.Value.Total,
                    CorrectCount = kv.Value.Correct,
                    AccuracyPercent = kv.Value.Total == 0 ? 0 : Math.Round(kv.Value.Correct * 100.0 / kv.Value.Total, 1)
                })
                .OrderBy(t => t.AccuracyPercent) // Xếp điểm yếu lên đầu
                .ThenByDescending(t => t.TotalQuestions)
                .ToList(),
            QuestionGroups = resultGroups
        };
    }
}
