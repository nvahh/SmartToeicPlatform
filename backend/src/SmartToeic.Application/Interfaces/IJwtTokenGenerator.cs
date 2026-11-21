using SmartToeic.Domain.Entities;

namespace SmartToeic.Application.Interfaces;

public interface IJwtTokenGenerator
{
    (string Token, DateTime ExpiresAt) GenerateToken(User user);
}
