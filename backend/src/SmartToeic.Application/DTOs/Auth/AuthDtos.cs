using System.ComponentModel.DataAnnotations;

namespace SmartToeic.Application.DTOs.Auth;

public class RegisterRequest
{
    [Required(ErrorMessage = "Email không được để trống.")]
    [EmailAddress(ErrorMessage = "Định dạng email không hợp lệ.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Mật khẩu không được để trống.")]
    [MinLength(6, ErrorMessage = "Mật khẩu phải có ít nhất 6 ký tự.")]
    public string Password { get; set; } = string.Empty;

    [Required(ErrorMessage = "Họ tên không được để trống.")]
    [MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

    [Range(10, 990, ErrorMessage = "Mục tiêu điểm TOEIC phải từ 10 đến 990.")]
    public int? TargetScore { get; set; }
}

public class LoginRequest
{
    [Required(ErrorMessage = "Email không được để trống.")]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Mật khẩu không được để trống.")]
    public string Password { get; set; } = string.Empty;
}

public class UpdateProfileRequest
{
    [Required(ErrorMessage = "Họ tên không được để trống.")]
    [MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

    [Range(10, 990, ErrorMessage = "Mục tiêu điểm TOEIC phải từ 10 đến 990.")]
    public int? TargetScore { get; set; }
}

public class ChangePasswordRequest
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    [MinLength(6, ErrorMessage = "Mật khẩu mới phải có ít nhất 6 ký tự.")]
    public string NewPassword { get; set; } = string.Empty;
}

public class UserProfileDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public int? TargetScore { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AuthResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public UserProfileDto User { get; set; } = null!;
}
