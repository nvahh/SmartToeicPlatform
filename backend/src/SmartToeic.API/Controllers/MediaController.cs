using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SmartToeic.API.Controllers;

public class UploadMediaRequest
{
    public IFormFile File { get; set; } = null!;
}

[ApiController]
[Route("api/[controller]")]
public class MediaController : ControllerBase
{
    private static readonly HashSet<string> AudioExtensions = new(StringComparer.OrdinalIgnoreCase)
        { ".mp3", ".wav", ".m4a", ".ogg" };

    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
        { ".jpg", ".jpeg", ".png", ".webp" };

    private const long MaxFileSizeBytes = 25 * 1024 * 1024; // 25 MB
    private readonly IWebHostEnvironment _env;

    public MediaController(IWebHostEnvironment env)
    {
        _env = env;
    }

    [HttpPost("upload")]
    [Authorize(Roles = "Admin")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Upload([FromForm] UploadMediaRequest request)
    {
        var file = request.File;
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Vui lòng chọn file để tải lên." });

        if (file.Length > MaxFileSizeBytes)
            return BadRequest(new { message = "Dung lượng file vượt quá giới hạn 25 MB." });

        var ext = Path.GetExtension(file.FileName);
        string subFolder;

        if (AudioExtensions.Contains(ext))
            subFolder = "audio";
        else if (ImageExtensions.Contains(ext))
            subFolder = "images";
        else
            return BadRequest(new { message = "Định dạng không hỗ trợ. Chỉ chấp nhận mp3, wav, m4a, ogg, jpg, png, webp." });

        var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
        var uploadDir = Path.Combine(webRoot, "uploads", subFolder);
        Directory.CreateDirectory(uploadDir);

        var fileName = $"{Guid.NewGuid():N}{ext.ToLowerInvariant()}";
        var fullPath = Path.Combine(uploadDir, fileName);

        await using (var stream = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var relativeUrl = $"/uploads/{subFolder}/{fileName}";
        return Ok(new
        {
            url = relativeUrl,
            type = subFolder,
            fileName,
            sizeBytes = file.Length
        });
    }
}
