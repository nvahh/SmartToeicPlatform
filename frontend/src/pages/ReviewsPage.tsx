import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Brain,
  CheckCircle2,
  Eye,
  Headphones,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { api, extractErrorMessage, resolveMediaUrl } from '../lib/api';
import type { ReviewDeckSummary, SubmitReviewResponse } from '../types/api';

const QUALITY_OPTIONS = [
  {
    quality: 1,
    label: 'Quên / Sai',
    sub: 'Ôn lại sau 1 ngày',
    cls: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100',
  },
  {
    quality: 3,
    label: 'Nhớ khó',
    sub: 'Cần nhắc sớm',
    cls: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100',
  },
  {
    quality: 4,
    label: 'Nhớ tốt',
    sub: 'Giãn lịch chuẩn',
    cls: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
  },
  {
    quality: 5,
    label: 'Rất dễ',
    sub: 'Giãn lịch dài',
    cls: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100',
  },
];

export function ReviewsPage() {
  const [deck, setDeck] = useState<ReviewDeckSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [pickedOption, setPickedOption] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const fetchDeck = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<ReviewDeckSummary>('/Reviews/due', { params: { limit: 30 } });
      setDeck(res.data);
      setPickedOption(null);
      setRevealed(false);
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể tải danh sách thẻ ôn tập.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDeck();
  }, []);

  const currentCard = deck?.dueCards[0] ?? null;

  const handleRate = async (quality: number) => {
    if (!currentCard || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.post<SubmitReviewResponse>(`/Reviews/${currentCard.cardId}/submit`, {
        quality,
      });
      setToast(res.data.message);
      setDeck((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          dueCount: Math.max(0, prev.dueCount - 1),
          masteredCount: res.data.intervalDays >= 21 ? prev.masteredCount + 1 : prev.masteredCount,
          dueCards: prev.dueCards.slice(1),
        };
      });
      setPickedOption(null);
      setRevealed(false);
    } catch (err) {
      alert(extractErrorMessage(err, 'Không thể lưu kết quả ôn tập.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCard = async () => {
    if (!currentCard) return;
    if (!window.confirm('Xóa thẻ này khỏi bộ ôn tập SM-2 của bạn?')) return;
    try {
      await api.delete(`/Reviews/${currentCard.cardId}`);
      setToast('Đã xóa thẻ khỏi bộ ôn tập.');
      setDeck((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          totalCards: Math.max(0, prev.totalCards - 1),
          dueCount: Math.max(0, prev.dueCount - 1),
          dueCards: prev.dueCards.slice(1),
        };
      });
      setPickedOption(null);
      setRevealed(false);
    } catch (err) {
      alert(extractErrorMessage(err, 'Không thể xóa thẻ.'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Brain className="w-7 h-7 text-indigo-600" />
              Phòng ôn tập SM-2
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Hệ thống tự động gom các câu làm sai và nhắc lại đúng thời điểm bạn sắp quên
            </p>
          </div>

          <button
            type="button"
            onClick={() => void fetchDeck()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer self-start"
          >
            <RotateCcw className="w-4 h-4" />
            Làm mới
          </button>
        </div>

        {/* Thống kê bộ thẻ */}
        {deck && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-extrabold text-indigo-600">{deck.dueCount}</div>
              <div className="text-xs font-medium text-slate-500 mt-1">Cần ôn hôm nay</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-extrabold text-slate-900">{deck.totalCards}</div>
              <div className="text-xs font-medium text-slate-500 mt-1">Tổng số thẻ</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-extrabold text-emerald-600">{deck.masteredCount}</div>
              <div className="text-xs font-medium text-slate-500 mt-1">Đã thành thạo (≥21 ngày)</div>
            </div>
          </div>
        )}

        {toast && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="h-80 bg-white rounded-2xl border border-slate-200 animate-pulse" />
        ) : !currentCard ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-bold text-slate-900">Tuyệt vời! Bạn đã ôn hết thẻ hôm nay</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Các thẻ đã ôn sẽ tự động quay lại theo lịch tối ưu của thuật toán SM-2. Bạn có thể làm
              thêm đề mới để mở rộng vốn câu hỏi.
            </p>
            <Link
              to="/exams"
              className="inline-block mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold"
            >
              Về Thư viện đề thi
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Thanh thông tin thẻ */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                  Part {currentCard.partNumber} • Câu {currentCard.questionNumber}
                </span>
                <span className="text-xs text-slate-500">
                  Lần lặp: <strong>{currentCard.repetition}</strong> • EF:{' '}
                  <strong>{currentCard.easeFactor}</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={() => void handleDeleteCard()}
                className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa thẻ
              </button>
            </div>

            {/* Mặt trước thẻ: Câu hỏi & Ngữ liệu */}
            <div className="p-6 space-y-5">
              {currentCard.audioUrl && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                  <Headphones className="w-5 h-5 text-indigo-600 shrink-0" />
                  <audio
                    key={currentCard.cardId}
                    controls
                    src={resolveMediaUrl(currentCard.audioUrl)}
                    className="w-full h-9"
                  />
                </div>
              )}

              {currentCard.imageUrl && (
                <img
                  src={resolveMediaUrl(currentCard.imageUrl)}
                  alt="Review visual"
                  className="max-h-72 rounded-xl border border-slate-200 object-contain mx-auto bg-slate-50"
                />
              )}

              {currentCard.passageHtml && (
                <div
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm leading-relaxed text-slate-800"
                  dangerouslySetInnerHTML={{ __html: currentCard.passageHtml }}
                />
              )}

              <div className="text-base font-semibold text-slate-900">
                {currentCard.content || 'Chọn đáp án đúng nhất:'}
              </div>

              <div className="space-y-2.5">
                {[
                  { key: 'A', label: currentCard.optionA },
                  { key: 'B', label: currentCard.optionB },
                  { key: 'C', label: currentCard.optionC },
                  { key: 'D', label: currentCard.optionD },
                ]
                  .filter((o) => o.label !== null && o.label !== undefined && o.label !== '')
                  .map((opt) => {
                    const isPicked = pickedOption === opt.key;
                    const isCorrect = opt.key === currentCard.correctOption;

                    let cls = 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-800';
                    if (revealed) {
                      if (isCorrect) cls = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold';
                      else if (isPicked) cls = 'border-rose-400 bg-rose-50 text-rose-900';
                      else cls = 'border-slate-200 text-slate-400';
                    } else if (isPicked) {
                      cls = 'border-indigo-600 bg-indigo-50 text-indigo-900 font-medium';
                    }

                    return (
                      <button
                        key={opt.key}
                        type="button"
                        disabled={revealed}
                        onClick={() => {
                          setPickedOption(opt.key);
                          setRevealed(true);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl border text-sm flex items-center gap-3 transition-all cursor-pointer ${cls}`}
                      >
                        <span className="w-6 h-6 rounded-full bg-white/80 border border-current flex items-center justify-center text-xs font-bold shrink-0">
                          {opt.key}
                        </span>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
              </div>

              {!revealed ? (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  Lật xem đáp án & Giải thích
                </button>
              ) : (
                <div className="space-y-4 pt-3 border-t border-slate-200">
                  <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 space-y-2 text-sm">
                    <div className="font-bold text-indigo-950">
                      Đáp án đúng: <span className="text-emerald-700">{currentCard.correctOption}</span>
                    </div>
                    {currentCard.explanation && (
                    <div
                    className="text-indigo-900 leading-relaxed space-y-1.5 [&_strong]:font-semibold"
                    dangerouslySetInnerHTML = {{ __html: currentCard.explanation }
                    }
                    />
                    )}
                    {currentCard.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {currentCard.tags.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded bg-white text-indigo-700 text-xs font-medium border border-indigo-200"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {currentCard.transcriptHtml && (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-slate-800">
                      <div className="font-semibold text-amber-900 mb-1">Transcript:</div>
                      <div dangerouslySetInnerHTML={{ __html: currentCard.transcriptHtml }} />
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-semibold text-slate-600 uppercase text-center mb-3">
                      Đánh giá mức độ ghi nhớ của bạn để SM-2 lên lịch ôn tiếp
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {QUALITY_OPTIONS.map((btn) => (
                        <button
                          key={btn.quality}
                          type="button"
                          disabled={submitting}
                          onClick={() => void handleRate(btn.quality)}
                          className={`p-3 rounded-xl border text-center transition-colors cursor-pointer disabled:opacity-50 ${btn.cls}`}
                        >
                          <div className="font-bold text-sm">{btn.label}</div>
                          <div className="text-[11px] opacity-80 mt-0.5">{btn.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
