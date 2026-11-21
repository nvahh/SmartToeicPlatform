using Microsoft.EntityFrameworkCore;
using SmartToeic.Domain.Entities;
using SmartToeic.Domain.Enums;

namespace SmartToeic.Infrastructure.Persistence;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        // 1. Seed tài khoản Admin mặc định
        if (!await context.Users.AnyAsync(u => u.Email == "admin@smarttoeic.com"))
        {
            context.Users.Add(new User
            {
                Email = "admin@smarttoeic.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
                FullName = "System Administrator",
                Role = UserRole.Admin,
                TargetScore = 990,
                IsActive = true
            });
        }

        // 2. Seed bảng quy đổi điểm TOEIC chuẩn (thang 5 - 495 cho mỗi kỹ năng)
        if (!await context.ScoreConversions.AnyAsync())
        {
            var conversions = new List<ScoreConversion>();
            for (int correct = 0; correct <= 100; correct++)
            {
                // Listening: 0-6 câu = 5 điểm, tăng 5 điểm mỗi câu, tối đa 495 (từ ~93 câu trở lên đạt 495)
                int lcScore = correct <= 6 ? 5 : Math.Min(495, (correct - 5) * 5 + 35);
                // Reading: 0-9 câu = 5 điểm, tăng 5 điểm mỗi câu, tối đa 495
                int rcScore = correct <= 9 ? 5 : Math.Min(495, (correct - 8) * 5 + 5);

                conversions.Add(new ScoreConversion
                {
                    Section = ToeicSection.Listening,
                    CorrectCount = correct,
                    ScaledScore = lcScore
                });
                conversions.Add(new ScoreConversion
                {
                    Section = ToeicSection.Reading,
                    CorrectCount = correct,
                    ScaledScore = rcScore
                });
            }
            await context.ScoreConversions.AddRangeAsync(conversions);
        }

        // 3. Seed danh sách KnowledgeTags chuẩn TOEIC
        if (!await context.KnowledgeTags.AnyAsync())
        {
            var tags = new List<KnowledgeTag>
            {
                new() { Name = "Part 5 - Từ loại (Word Forms)", Category = "Grammar" },
                new() { Name = "Part 5 - Thì động từ (Tenses)", Category = "Grammar" },
                new() { Name = "Part 5 - Mệnh đề quan hệ (Relative Clauses)", Category = "Grammar" },
                new() { Name = "Part 5 - Liên từ & Giới từ", Category = "Grammar" },
                new() { Name = "Part 5 - Từ vựng doanh nghiệp", Category = "Vocab" },
                new() { Name = "Part 6 - Điền câu vào đoạn văn", Category = "Reading" },
                new() { Name = "Part 7 - Tìm thông tin chi tiết", Category = "Reading" },
                new() { Name = "Part 7 - Câu hỏi suy luận (Inference)", Category = "Reading" },
                new() { Name = "Part 7 - Câu hỏi phủ định (NOT/EXCEPT)", Category = "Reading" },
                new() { Name = "Part 1 - Mô tả tranh người & vật", Category = "Listening" },
                new() { Name = "Part 2 - Câu hỏi Wh- & Yes/No", Category = "Listening" },
                new() { Name = "Part 3 & 4 - Nghe ý chính & Suy luận", Category = "Listening" }
            };
            await context.KnowledgeTags.AddRangeAsync(tags);
        }

        await context.SaveChangesAsync();
    }
}