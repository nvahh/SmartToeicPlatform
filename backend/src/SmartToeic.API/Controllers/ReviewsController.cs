using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartToeic.Application.DTOs.Reviews;
using SmartToeic.Application.Interfaces;

namespace SmartToeic.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReviewsController : ControllerBase
{
    private readonly IReviewService _reviewService;

    public ReviewsController(IReviewService reviewService)
    {
        _reviewService = reviewService;
    }

    [HttpGet("due")]
    public async Task<IActionResult> GetDueReviews([FromQuery] int limit = 20)
    {
        var summary = await _reviewService.GetDueReviewsAsync(GetCurrentUserId(), limit);
        return Ok(summary);
    }

    [HttpPost("{cardId:guid}/submit")]
    public async Task<IActionResult> SubmitReview(Guid cardId, [FromBody] SubmitReviewRequest request)
    {
        try
        {
            var res = await _reviewService.SubmitReviewAsync(GetCurrentUserId(), cardId, request);
            return Ok(res);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("bookmark/{questionId:guid}")]
    public async Task<IActionResult> BookmarkQuestion(Guid questionId)
    {
        try
        {
            var card = await _reviewService.BookmarkQuestionAsync(GetCurrentUserId(), questionId);
            return Ok(card);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpDelete("{cardId:guid}")]
    public async Task<IActionResult> DeleteCard(Guid cardId)
    {
        try
        {
            await _reviewService.DeleteCardAsync(GetCurrentUserId(), cardId);
            return Ok(new { message = "Đã xóa thẻ khỏi bộ ôn tập." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
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
