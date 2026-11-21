using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartToeic.Application.DTOs.Attempts;
using SmartToeic.Application.Interfaces;

namespace SmartToeic.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AttemptsController : ControllerBase
{
    private readonly IAttemptService _attemptService;

    public AttemptsController(IAttemptService attemptService)
    {
        _attemptService = attemptService;
    }

    [HttpPost("start")]
    public async Task<IActionResult> Start([FromBody] StartAttemptRequest request)
    {
        try
        {
            var result = await _attemptService.StartAttemptAsync(GetCurrentUserId(), request);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetMyAttempts()
    {
        var history = await _attemptService.GetMyAttemptsAsync(GetCurrentUserId());
        return Ok(history);
    }

    [HttpGet("{id:guid}/session")]
    public async Task<IActionResult> GetSession(Guid id)
    {
        try
        {
            var session = await _attemptService.GetAttemptSessionAsync(GetCurrentUserId(), id);
            return Ok(session);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}/answers")]
    public async Task<IActionResult> SaveAnswers(Guid id, [FromBody] SaveAnswersBatchRequest request)
    {
        try
        {
            await _attemptService.SaveAnswersAsync(GetCurrentUserId(), id, request);
            return Ok(new { message = "Đã lưu đáp án." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/submit")]
    public async Task<IActionResult> Submit(Guid id, [FromBody] SubmitAttemptRequest? request)
    {
        try
        {
            var result = await _attemptService.SubmitAttemptAsync(GetCurrentUserId(), id, request);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{id:guid}/result")]
    public async Task<IActionResult> GetResult(Guid id)
    {
        try
        {
            var result = await _attemptService.GetAttemptResultAsync(GetCurrentUserId(), id);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private Guid GetCurrentUserId()
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")
            ?? throw new UnauthorizedAccessException("Token không hợp lệ.");

        return Guid.Parse(idStr);
    }
}
