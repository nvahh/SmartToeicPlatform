namespace SmartToeic.Domain.Enums;

public enum UserRole
{
    Learner = 0,
    Admin = 1
}

public enum ExamStatus
{
    Draft = 0,
    Published = 1
}

public enum ExamMode
{
    FullTest = 0,
    Practice = 1
}

public enum AttemptStatus
{
    InProgress = 0,
    Completed = 1
}

public enum ToeicSection
{
    Listening = 0,
    Reading = 1
}