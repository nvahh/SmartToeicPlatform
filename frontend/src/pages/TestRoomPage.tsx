import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Headphones,
  Save,
  Send,
} from 'lucide-react';
import { api, extractErrorMessage, resolveMediaUrl } from '../lib/api';
import type { AttemptSession } from '../types/api';

interface LocalAnswerState {
  selectedOption: string | null;
  isFlagged: boolean;
  timeSpentSeconds: number;
}

function formatTimer(seconds: number): string {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TestRoomPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<AttemptSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [answers, setAnswers] = useState<Record<string, LocalAnswerState>>({});
  const [savingText, setSavingText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const remainingRef = useRef(remainingSeconds);
  remainingRef.current = remainingSeconds;
  const hasSubmittedRef = useRef(false);

  // Tải phiên thi
  useEffect(() => {
    if (!attemptId) return;
    let active = true;
    (async () => {
      try {
        const res = await api.get<AttemptSession>(`/Attempts/${attemptId}/session`);
        if (!active) return;
        setSession(res.data);
        setRemainingSeconds(res.data.remainingSeconds);

        const initMap: Record<string, LocalAnswerState> = {};
        for (const g of res.data.questionGroups) {
          for (const q of g.questions) {
            initMap[q.id] = {
              selectedOption: q.selectedOption ?? null,
              isFlagged: q.isFlagged,
              timeSpentSeconds: q.timeSpentSeconds,
            };
          }
        }
        setAnswers(initMap);
      } catch (err) {
        if (active) setError(extractErrorMessage(err, 'Không thể mở phiên thi.'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [attemptId]);

  const buildPayloadAnswers = useCallback(() => {
    return Object.entries(answersRef.current).map(([questionId, st]) => ({
      questionId,
      selectedOption: st.selectedOption,
      isFlagged: st.isFlagged,
      timeSpentSeconds: st.timeSpentSeconds,
    }));
  }, []);

  const handleSaveDraft = useCallback(
    async (silent = false) => {
      if (!attemptId || hasSubmittedRef.current) return;
      try {
        if (!silent) setSavingText('Đang lưu...');
        await api.put(`/Attempts/${attemptId}/answers`, {
          remainingSeconds: remainingRef.current,
          answers: buildPayloadAnswers(),
        });
        setSavingText(`Đã lưu lúc ${new Date().toLocaleTimeString('vi-VN')}`);
      } catch {
        if (!silent) setSavingText('Lưu nháp thất bại');
      }
    },
    [attemptId, buildPayloadAnswers]
  );

  const handleSubmit = useCallback(
    async (auto = false) => {
      if (!attemptId || hasSubmittedRef.current) return;
      if (!auto) {
        const answeredCount = Object.values(answersRef.current).filter((a) => a.selectedOption).length;
        const total = session?.totalQuestions ?? 0;
        const ok = window.confirm(
          `Bạn đã trả lời ${answeredCount}/${total} câu hỏi. Xác nhận nộp bài và chấm điểm ngay?`
        );
        if (!ok) return;
      }

      hasSubmittedRef.current = true;
      setSubmitting(true);
      try {
        await api.post(`/Attempts/${attemptId}/submit`, {
          remainingSeconds: remainingRef.current,
          answers: buildPayloadAnswers(),
        });
        navigate(`/result/${attemptId}`, { replace: true });
      } catch (err) {
        hasSubmittedRef.current = false;
        setSubmitting(false);
        alert(extractErrorMessage(err, 'Nộp bài thất bại, vui lòng thử lại.'));
      }
    },
    [attemptId, buildPayloadAnswers, navigate, session?.totalQuestions]
  );

  // Đồng hồ đếm ngược 1s + tự động nộp khi hết giờ
  useEffect(() => {
    if (!session || loading) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          void handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session, loading, handleSubmit]);

  // Auto-save mỗi 30 giây
  useEffect(() => {
    if (!session || loading) return;
    const autoSave = window.setInterval(() => {
      void handleSaveDraft(true);
    }, 30000);
    return () => window.clearInterval(autoSave);
  }, [session, loading, handleSaveDraft]);

  const availableParts = useMemo(() => {
    if (!session) return [];
    const seen = new Map<number, number>();
    session.questionGroups.forEach((g, idx) => {
      if (!seen.has(g.partNumber)) seen.set(g.partNumber, idx);
    });
    return Array.from(seen.entries());
  }, [session]);

  const answeredCount = useMemo(
    () => Object.values(answers).filter((a) => Boolean(a.selectedOption)).length,
    [answers]
  );

  const selectOption = (questionId: string, option: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] ?? { selectedOption: null, isFlagged: false, timeSpentSeconds: 0 }),
        selectedOption: option,
      },
    }));
  };

  const toggleFlag = (questionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] ?? { selectedOption: null, isFlagged: false, timeSpentSeconds: 0 }),
        isFlagged: !prev[questionId]?.isFlagged,
      },
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Đang chuẩn bị phòng thi...
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <div className="text-rose-600 font-medium">{error || 'Không tìm thấy phiên thi.'}</div>
        <button
          onClick={() => navigate('/exams')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm cursor-pointer"
        >
          Quay lại Thư viện đề
        </button>
      </div>
    );
  }

  const currentGroup = session.questionGroups[currentGroupIndex];
  const hasLeftStimulus = Boolean(currentGroup?.imageUrl || currentGroup?.passageHtml);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Thanh trên cùng của phòng thi */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-bold text-slate-900 truncate text-sm sm:text-base">{session.examTitle}</h1>
          <div className="text-xs text-slate-500">
            {session.mode} • Đã làm {answeredCount}/{session.totalQuestions} câu
            {savingText && <span className="ml-2 text-emerald-600">• {savingText}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-bold text-sm ${
              remainingSeconds <= 300 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            {formatTimer(remainingSeconds)}
          </div>

          <button
            type="button"
            onClick={() => void handleSaveDraft(false)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Lưu nháp
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit(false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Đang chấm...' : 'Nộp bài'}
          </button>
        </div>
      </header>

      {/* Thanh chuyển nhanh theo Part */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2 flex items-center gap-2 overflow-x-auto">
        {availableParts.map(([partNum, firstIdx]) => {
          const active = currentGroup?.partNumber === partNum;
          return (
            <button
              key={partNum}
              type="button"
              onClick={() => setCurrentGroupIndex(firstIdx)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Part {partNum}
            </button>
          );
        })}
      </div>

      {/* Khu vực làm bài chính + Question Palette */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột nội dung câu hỏi */}
        <div className="lg:col-span-9 space-y-4">
          {currentGroup && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
                  Part {currentGroup.partNumber} • Nhóm {currentGroupIndex + 1}/{session.questionGroups.length}
                </span>
                <span className="text-xs text-slate-500">
                  Câu {currentGroup.questions[0]?.questionNumber}
                  {currentGroup.questions.length > 1
                    ? ` - ${currentGroup.questions[currentGroup.questions.length - 1]?.questionNumber}`
                    : ''}
                </span>
              </div>

              {/* Trình phát Audio cho Listening */}
              {currentGroup.audioUrl && (
                <div className="mb-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                  <Headphones className="w-5 h-5 text-indigo-600 shrink-0" />
                  <audio
                    key={currentGroup.id}
                    controls
                    src={resolveMediaUrl(currentGroup.audioUrl)}
                    className="w-full h-10"
                  />
                </div>
              )}

              {/* Bố cục 2 cột nếu có Ảnh hoặc Đoạn văn (Part 1, 3, 4, 6, 7), ngược lại 1 cột gọn */}
              <div className={hasLeftStimulus ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-6'}>
                {hasLeftStimulus && (
                  <div className="space-y-4 md:max-h-[65vh] md:overflow-y-auto md:pr-2">
                    {currentGroup.imageUrl && (
                      <img
                        src={resolveMediaUrl(currentGroup.imageUrl)}
                        alt={`Part ${currentGroup.partNumber}`}
                        className="w-full rounded-xl border border-slate-200 object-contain max-h-96 bg-slate-50"
                      />
                    )}
                    {currentGroup.passageHtml && (
                      <div
                        className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm leading-relaxed text-slate-800 space-y-2"
                        dangerouslySetInnerHTML={{ __html: currentGroup.passageHtml }}
                      />
                    )}
                  </div>
                )}

                <div className="space-y-5">
                  {currentGroup.questions.map((q) => {
                    const state = answers[q.id];
                    const options = [
                      { key: 'A', label: q.optionA },
                      { key: 'B', label: q.optionB },
                      { key: 'C', label: q.optionC },
                      { key: 'D', label: q.optionD },
                    ].filter((o) => o.label !== null && o.label !== undefined && o.label !== '');

                    return (
                      <div key={q.id} className="p-4 rounded-xl border border-slate-200 bg-white">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="text-sm font-semibold text-slate-900">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold mr-2">
                              {q.questionNumber}
                            </span>
                            {q.content || 'Chọn đáp án đúng nhất:'}
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleFlag(q.id)}
                            title="Đánh dấu xem lại"
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                              state?.isFlagged
                                ? 'bg-amber-100 text-amber-600'
                                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                            }`}
                          >
                            <Flag className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-2">
                          {options.map((opt) => {
                            const checked = state?.selectedOption === opt.key;
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => selectOption(q.id, opt.key)}
                                className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-sm flex items-center gap-3 transition-all cursor-pointer ${
                                  checked
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-medium'
                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <span
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                    checked ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {opt.key}
                                </span>
                                <span>{opt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Điều hướng nhóm trước / sau */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={currentGroupIndex === 0}
                  onClick={() => setCurrentGroupIndex((i) => Math.max(0, i - 1))}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Nhóm trước
                </button>

                <button
                  type="button"
                  disabled={currentGroupIndex >= session.questionGroups.length - 1}
                  onClick={() =>
                    setCurrentGroupIndex((i) => Math.min(session.questionGroups.length - 1, i + 1))
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  Nhóm tiếp
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cột phải: Bảng điều hướng câu hỏi (Question Palette) */}
        <aside className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm lg:sticky lg:top-20">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Bảng câu hỏi</h2>

          <div className="flex flex-wrap gap-3 text-xs text-slate-600 mb-4 pb-3 border-b border-slate-100">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-indigo-600 inline-block" /> Đã làm
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Cắm cờ
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded border border-slate-300 inline-block" /> Chưa làm
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2 max-h-[55vh] overflow-y-auto pr-1">
            {session.questionGroups.map((group, gIdx) =>
              group.questions.map((q) => {
                const st = answers[q.id];
                const isCurrent = gIdx === currentGroupIndex;
                let colorCls = 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50';
                if (st?.isFlagged) colorCls = 'bg-amber-400 border-amber-500 text-white';
                else if (st?.selectedOption) colorCls = 'bg-indigo-600 border-indigo-600 text-white';

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentGroupIndex(gIdx)}
                    className={`h-9 rounded-lg border text-xs font-bold transition-all cursor-pointer ${colorCls} ${
                      isCurrent ? 'ring-2 ring-slate-900 ring-offset-1' : ''
                    }`}
                  >
                    {q.questionNumber}
                  </button>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
