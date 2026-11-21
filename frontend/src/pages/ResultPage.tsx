import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  BookmarkCheck,
  BookmarkPlus,
  Brain,
  CheckCircle2,
  Headphones,
  MinusCircle,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Navbar } from '../components/Navbar';
import { api, extractErrorMessage, resolveMediaUrl } from '../lib/api';
import type { AttemptResult } from '../types/api';

type FilterMode = 'all' | 'wrong' | 'correct' | 'flagged';

export function ResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [bookmarkedIds, setBookmarkedIds] = useState<Record<string, boolean>>({});
  const [bookmarkLoading, setBookmarkLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) return;
    let active = true;
    (async () => {
      try {
        const res = await api.get<AttemptResult>(`/Attempts/${attemptId}/result`);
        if (active) setResult(res.data);
      } catch (err) {
        if (active) setError(extractErrorMessage(err, 'Không thể tải kết quả bài thi.'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [attemptId]);

  const handleBookmark = async (questionId: string) => {
    setBookmarkLoading(questionId);
    try {
      await api.post(`/Reviews/bookmark/${questionId}`);
      setBookmarkedIds((prev) => ({ ...prev, [questionId]: true }));
    } catch (err) {
      alert(extractErrorMessage(err, 'Không thể lưu câu hỏi vào bộ thẻ ôn tập.'));
    } finally {
      setBookmarkLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center text-slate-500">
          Đang tổng hợp kết quả và phân tích điểm...
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
          <div className="text-rose-600 font-medium">{error || 'Không tìm thấy kết quả.'}</div>
          <Link
            to="/exams"
            className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
          >
            Quay về Thư viện đề
          </Link>
        </div>
      </div>
    );
  }

  const partChartData = result.partBreakdown.map((p) => ({
    name: `Part ${p.partNumber}`,
    accuracy: p.accuracyPercent,
    label: `${p.correctCount}/${p.totalQuestions}`,
  }));

  const accuracyOverall =
    result.totalQuestions > 0
      ? Math.round((result.correctCount * 1000) / result.totalQuestions) / 10
      : 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header & nút điều hướng */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              to="/history"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại Lịch sử thi
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">{result.examTitle}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Chế độ: <span className="font-medium text-slate-700">{result.mode}</span>
              {result.selectedParts ? ` (Part ${result.selectedParts})` : ''} • Nộp lúc{' '}
              {result.submittedAt ? new Date(result.submittedAt).toLocaleString('vi-VN') : '-'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {result.wrongCount + result.skippedCount > 0 && (
              <Link
                to="/reviews"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Brain className="w-4 h-4" />
                Ôn ngay {result.wrongCount + result.skippedCount} câu sai bằng SM-2
              </Link>
            )}
            <Link
              to="/exams"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl"
            >
              Làm đề khác
            </Link>
          </div>
        </div>

        {/* 4 thẻ tổng quan điểm số */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-indigo-600 text-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-indigo-100 text-xs font-semibold uppercase">Tổng điểm TOEIC</span>
              <Award className="w-5 h-5 text-indigo-200" />
            </div>
            <div className="text-4xl font-extrabold mt-2">
              {result.totalScore}
              <span className="text-base font-medium text-indigo-200"> / 990</span>
            </div>
            <div className="text-xs text-indigo-100 mt-2">
              Tỷ lệ chính xác chung: <strong>{accuracyOverall}%</strong>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase">Listening</div>
            <div className="text-3xl font-bold text-slate-900 mt-2">
              {result.listeningScore}
              <span className="text-sm font-normal text-slate-400"> / 495</span>
            </div>
            <div className="text-xs text-slate-600 mt-2">
              Đúng <strong>{result.listeningCorrect}</strong> câu Listening
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase">Reading</div>
            <div className="text-3xl font-bold text-slate-900 mt-2">
              {result.readingScore}
              <span className="text-sm font-normal text-slate-400"> / 495</span>
            </div>
            <div className="text-xs text-slate-600 mt-2">
              Đúng <strong>{result.readingCorrect}</strong> câu Reading
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
            <div className="text-xs font-semibold text-slate-500 uppercase">Chi tiết câu trả lời</div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div className="p-2 rounded-xl bg-emerald-50">
                <div className="text-lg font-bold text-emerald-700">{result.correctCount}</div>
                <div className="text-[11px] text-emerald-600 font-medium">Đúng</div>
              </div>
              <div className="p-2 rounded-xl bg-rose-50">
                <div className="text-lg font-bold text-rose-700">{result.wrongCount}</div>
                <div className="text-[11px] text-rose-600 font-medium">Sai</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-100">
                <div className="text-lg font-bold text-slate-700">{result.skippedCount}</div>
                <div className="text-[11px] text-slate-500 font-medium">Bỏ qua</div>
              </div>
            </div>
          </div>
        </div>

        {/* Biểu đồ phân tích theo Part & Danh sách lỗ hổng kiến thức (Tags) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1">Độ chính xác theo từng Part (%)</h2>
            <p className="text-xs text-slate-500 mb-4">
              Thanh màu đỏ/cam cho biết các Part cần ưu tiên luyện thêm
            </p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={partChartData} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(val) => [`${val ?? 0}%`, 'Chính xác']}
                    contentStyle={{ borderRadius: '12px', borderColor: '#e2e8f0' }}
                  />
                  <Bar dataKey="accuracy" radius={[8, 8, 0, 0]} maxBarSize={48}>
                    {partChartData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={
                          entry.accuracy >= 80
                            ? '#10b981'
                            : entry.accuracy >= 50
                              ? '#f59e0b'
                              : '#ef4444'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1">Phân tích điểm yếu theo chủ điểm</h2>
            <p className="text-xs text-slate-500 mb-4">
              Tự động xếp các dạng câu hỏi bạn làm sai nhiều nhất lên đầu
            </p>

            {result.tagBreakdown.length === 0 ? (
              <div className="text-sm text-slate-400 py-10 text-center">
                Đề thi này chưa gắn thẻ kiến thức cho câu hỏi.
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {result.tagBreakdown.map((tag) => {
                  const barColor =
                    tag.accuracyPercent >= 80
                      ? 'bg-emerald-500'
                      : tag.accuracyPercent >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500';
                  return (
                    <div key={tag.tagName} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800 truncate pr-2">{tag.tagName}</span>
                        <span className="font-semibold text-slate-600 shrink-0">
                          {tag.correctCount}/{tag.totalQuestions} ({tag.accuracyPercent}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${Math.max(4, tag.accuracyPercent)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chi tiết từng câu hỏi + Lời giải + Transcript */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">Chi tiết bài làm & Lời giải</h2>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'all', label: `Tất cả (${result.totalQuestions})` },
                  { id: 'wrong', label: `Sai / Bỏ qua (${result.wrongCount + result.skippedCount})` },
                  { id: 'correct', label: `Đúng (${result.correctCount})` },
                  { id: 'flagged', label: 'Đã cắm cờ' },
                ] as { id: FilterMode; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    filter === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {result.questionGroups.map((group) => {
            const visibleQuestions = group.questions.filter((q) => {
              if (filter === 'wrong') return !q.isCorrect;
              if (filter === 'correct') return q.isCorrect;
              if (filter === 'flagged') return q.isFlagged;
              return true;
            });

            if (visibleQuestions.length === 0) return null;

            return (
              <div key={group.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
                    Part {group.partNumber}
                  </span>
                </div>

                {group.audioUrl && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                    <Headphones className="w-5 h-5 text-indigo-600 shrink-0" />
                    <audio controls src={resolveMediaUrl(group.audioUrl)} className="w-full h-9" />
                  </div>
                )}

                {group.imageUrl && (
                  <img
                    src={resolveMediaUrl(group.imageUrl)}
                    alt={`Part ${group.partNumber}`}
                    className="max-h-72 rounded-xl border border-slate-200 object-contain bg-slate-50"
                  />
                )}

                {group.passageHtml && (
                  <div
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm leading-relaxed text-slate-800"
                    dangerouslySetInnerHTML={{ __html: group.passageHtml }}
                  />
                )}

                {group.transcriptHtml && (
                  <details className="rounded-xl bg-amber-50/70 border border-amber-200 p-3.5 text-sm">
                    <summary className="font-semibold text-amber-900 cursor-pointer">
                      Xem Transcript bài nghe
                    </summary>
                    <div
                      className="mt-2 text-slate-800 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: group.transcriptHtml }}
                    />
                  </details>
                )}

                <div className="space-y-4">
                  {visibleQuestions.map((q) => {
                    const options = [
                      { key: 'A', label: q.optionA },
                      { key: 'B', label: q.optionB },
                      { key: 'C', label: q.optionC },
                      { key: 'D', label: q.optionD },
                    ].filter((o) => o.label !== null && o.label !== undefined && o.label !== '');

                    const isSaved = bookmarkedIds[q.id];

                    return (
                      <div key={q.id} className="p-4 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            {q.isCorrect ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            ) : q.selectedOption ? (
                              <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                            ) : (
                              <MinusCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                Câu {q.questionNumber}: {q.content || 'Chọn đáp án đúng nhất'}
                              </div>
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {q.tags.map((t) => (
                                  <span
                                    key={t}
                                    className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={bookmarkLoading === q.id || isSaved}
                            onClick={() => void handleBookmark(q.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium shrink-0 cursor-pointer transition-colors ${
                              isSaved
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700'
                            }`}
                          >
                            {isSaved ? (
                              <>
                                <BookmarkCheck className="w-3.5 h-3.5" /> Đã lưu SM-2
                              </>
                            ) : (
                              <>
                                <BookmarkPlus className="w-3.5 h-3.5" /> Lưu ôn SM-2
                              </>
                            )}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {options.map((opt) => {
                            const isCorrectOpt = opt.key === q.correctOption;
                            const isUserWrong = opt.key === q.selectedOption && !q.isCorrect;

                            let cls = 'border-slate-200 bg-white text-slate-700';
                            if (isCorrectOpt)
                              cls = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold';
                            else if (isUserWrong)
                              cls = 'border-rose-400 bg-rose-50 text-rose-900 font-medium';

                            return (
                              <div key={opt.key} className={`px-3 py-2 rounded-lg border text-sm ${cls}`}>
                                <span className="font-bold mr-2">{opt.key}.</span>
                                {opt.label}
                              </div>
                            );
                          })}
                        </div>

                        <div className="text-xs text-slate-600 flex flex-wrap gap-4">
                          <span>
                            Bạn chọn: <strong>{q.selectedOption ?? 'Bỏ trống'}</strong>
                          </span>
                          <span>
                            Đáp án đúng: <strong className="text-emerald-700">{q.correctOption}</strong>
                          </span>
                        </div>

                        {q.explanation && (
                          <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-100 text-sm text-indigo-950">
                            <span className="font-semibold">Giải thích: </span>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
