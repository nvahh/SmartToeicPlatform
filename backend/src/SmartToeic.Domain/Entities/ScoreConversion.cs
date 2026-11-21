using SmartToeic.Domain.Enums;

namespace SmartToeic.Domain.Entities;

public class ScoreConversion
{
    public int Id { get; set; }
    public ToeicSection Section { get; set; }
    public int CorrectCount { get; set; } // 0 -> 100
    public int ScaledScore { get; set; }  // 5 -> 495
}