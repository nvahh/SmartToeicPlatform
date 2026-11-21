using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartToeic.Application.DTOs.Exams;
using SmartToeic.Application.Interfaces;

namespace SmartToeic.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ExamsController : ControllerBase
{
    private readonly IExamService _examService;

    public ExamsController(IExamService examService)
    {
        _examService = examService;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetExams([FromQuery] string? search, [FromQuery] int? year)
    {
        var isAdmin = User.IsInRole("Admin");
        var exams = await _examService.GetExamsAsync(isAdmin, search, year);
        return Ok(exams);
    }

    [HttpGet("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> GetExamDetail(Guid id)
    {
        try
        {
            var isAdmin = User.IsInRole("Admin");
            var detail = await _examService.GetExamDetailAsync(id, includeAnswers: isAdmin);
            return Ok(detail);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { message = ex.Message });
        }
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateExam([FromBody] CreateExamRequest request)
    {
        var created = await _examService.CreateExamAsync(request);
        return CreatedAtAction(nameof(GetExamDetail), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateExam(Guid id, [FromBody] UpdateExamRequest request)
    {
        try
        {
            var updated = await _examService.UpdateExamAsync(id, request);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPatch("{id:guid}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateExamStatusRequest request)
    {
        try
        {
            await _examService.UpdateExamStatusAsync(id, request.Status);
            return Ok(new { message = "Cập nhật trạng thái đề thi thành công." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteExam(Guid id)
    {
        try
        {
            await _examService.SoftDeleteExamAsync(id);
            return Ok(new { message = "Đã xóa mềm đề thi thành công." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/groups")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddQuestionGroup(Guid id, [FromBody] CreateQuestionGroupRequest request)
    {
        try
        {
            var group = await _examService.AddQuestionGroupAsync(id, request);
            return Ok(group);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpDelete("groups/{groupId:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteQuestionGroup(Guid groupId)
    {
        try
        {
            await _examService.DeleteQuestionGroupAsync(groupId);
            return Ok(new { message = "Đã xóa nhóm câu hỏi." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPatch("groups/{groupId:guid}/media")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateQuestionGroupMedia(Guid groupId, [FromBody] UpdateQuestionGroupMediaRequest request)
    {
        try
        {
            var updated = await _examService.UpdateQuestionGroupMediaAsync(groupId, request);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("bulk-import")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> BulkImport([FromBody] BulkImportExamRequest request)
    {
        var detail = await _examService.BulkImportExamAsync(request);
        return CreatedAtAction(nameof(GetExamDetail), new { id = detail.Id }, detail);
    }

    [HttpGet("tags")]
    [AllowAnonymous]
    public async Task<IActionResult> GetTags()
    {
        var tags = await _examService.GetKnowledgeTagsAsync();
        return Ok(tags);
    }

    [HttpPost("tags")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateTag([FromBody] CreateKnowledgeTagRequest request)
    {
        try
        {
            var tag = await _examService.CreateKnowledgeTagAsync(request);
            return Ok(tag);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
