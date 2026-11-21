export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'Learner' | 'Admin' | string;
  targetScore?: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresAt: string;
  user: UserProfile;
}

export interface ExamSummary {
  id: string;
  title: string;
  year?: number | null;
  source?: string | null;
  durationMinutes: number;
  status: string;
  totalQuestions: number;
  createdAt: string;
}

export interface AttemptQuestion {
  id: string;
  questionNumber: number;
  content?: string | null;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  selectedOption?: string | null;
  isFlagged: boolean;
  timeSpentSeconds: number;
}

export interface AttemptQuestionGroup {
  id: string;
  partNumber: number;
  orderIndex: number;
  audioUrl?: string | null;
  imageUrl?: string | null;
  passageHtml?: string | null;
  questions: AttemptQuestion[];
}

export interface AttemptSession {
  attemptId: string;
  examId: string;
  examTitle: string;
  mode: string;
  selectedParts?: string | null;
  status: string;
  startedAt: string;
  remainingSeconds: number;
  totalQuestions: number;
  questionGroups: AttemptQuestionGroup[];
}

export interface AttemptSummary {
  id: string;
  examId: string;
  examTitle: string;
  mode: string;
  selectedParts?: string | null;
  status: string;
  startedAt: string;
  submittedAt?: string | null;
  listeningCorrect: number;
  readingCorrect: number;
  listeningScore: number;
  readingScore: number;
  totalScore: number;
}

export interface PartStat {
  partNumber: number;
  totalQuestions: number;
  correctCount: number;
  accuracyPercent: number;
}

export interface TagStat {
  tagName: string;
  category: string;
  totalQuestions: number;
  correctCount: number;
  accuracyPercent: number;
}

export interface AttemptResultQuestion {
  id: string;
  questionNumber: number;
  content?: string | null;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  selectedOption?: string | null;
  correctOption: string;
  isCorrect: boolean;
  isFlagged: boolean;
  timeSpentSeconds: number;
  explanation?: string | null;
  tags: string[];
}

export interface AttemptResultGroup {
  id: string;
  partNumber: number;
  orderIndex: number;
  audioUrl?: string | null;
  imageUrl?: string | null;
  passageHtml?: string | null;
  transcriptHtml?: string | null;
  questions: AttemptResultQuestion[];
}

export interface AttemptResult {
  attemptId: string;
  examId: string;
  examTitle: string;
  mode: string;
  selectedParts?: string | null;
  startedAt: string;
  submittedAt?: string | null;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  listeningCorrect: number;
  readingCorrect: number;
  listeningScore: number;
  readingScore: number;
  totalScore: number;
  newReviewCardsQueued: number;
  partBreakdown: PartStat[];
  tagBreakdown: TagStat[];
  questionGroups: AttemptResultGroup[];
}

export interface ReviewCard {
  cardId: string;
  questionId: string;
  partNumber: number;
  questionNumber: number;
  audioUrl?: string | null;
  imageUrl?: string | null;
  passageHtml?: string | null;
  transcriptHtml?: string | null;
  content?: string | null;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  correctOption: string;
  explanation?: string | null;
  tags: string[];
  easeFactor: number;
  intervalDays: number;
  repetition: number;
  nextReviewDate: string;
  lastReviewedAt?: string | null;
}

export interface ReviewDeckSummary {
  totalCards: number;
  dueCount: number;
  masteredCount: number;
  dueCards: ReviewCard[];
}

export interface SubmitReviewResponse {
  cardId: string;
  easeFactor: number;
  intervalDays: number;
  repetition: number;
  nextReviewDate: string;
  lastReviewedAt: string;
  message: string;
}
