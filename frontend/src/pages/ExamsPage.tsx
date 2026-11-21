import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock, FileText, Play, Search, SlidersHorizontal, X } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { api, extractErrorMessage } from '../lib/api';
import type { AttemptSession, ExamSummary } from '../types/api';

const PART_LABELS: Record<number, string> = {
  1: 'Part 1 - Mô tả tranh',
  2: 'Part 2 - Hỏi đáp',
  3: 'Part 3 - Hội thoại ngắn',
  4: 'Part 4 - Bài nói ngắn',
  5: 'Part 5 - Điền câu',
  6: 'Part 6 - Điền đoạn văn',
  7: 'Part 7 - Đọc hiểu',
};

export function ExamsPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedExam, setSelectedExam] = useState<ExamSummary | null>(null);
  const [mode, setMode] = useState<0 | 1>(0); // 0 = FullTest, 1 = Practice
  const [selectedParts, setSelectedParts] = useState<number[]>([5, 7]);
  const [customMinutes, setCustomMinutes] = useState<number>(30);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  const fetchExams = async (keyword = '') => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<ExamSummary[]>('/Exams', {
        params: keyword ? { search: keyword } : undefined,
      });
      setExams(res.data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể tải danh sách đề thi.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchExams();
  }, []);

  const togglePart = (part: number) => {
    setSelectedParts((prev) =>
      prev.includes(part) ? prev.filter((p) => p !== part) : [...prev, part].sort((a, b) => a - b)
    );
  };

  const handleStartAttempt = async () => {
    if (!selectedExam) return;
    setStartError('');
    setStarting(true);
    try {
      const res = await api.post<AttemptSession>('/Attempts/start', {
        examId: selectedExam.id,
        mode,
        selectedParts: mode === 1 ? selectedParts : undefined,
        customDurationMinutes: mode === 1 ? customMinutes : undefined,
      });
      navigate(`/test/${res.data.attemptId}`);
    } catch (err) {
      setStartError(extractErrorMessage(err, 'Không thể bắt đầu bài thi.'));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Thư viện đề thi TOEIC</h1>
            <p className="text-sm text-slate-500 mt-1">
              Chọn đề để làm Full Test 200 câu hoặc luyện tập chuyên sâu từng Part
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void fetchExams(search);
            }}
            className="flex gap-2 w-full md:w-96"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm đề thi ETS, 2026..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 cursor-pointer"
            >
              Tìm
            </button>
          </form>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 bg-white rounded-2xl border border-slate-200 animate-pulse p-6" />
            ))}
          </div>
        ) : exams.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-slate-800">Chưa có đề thi nào</h2>
            <p className="text-sm text-slate-500 mt-1">
              Admin có thể nạp đề thi mẫu bằng tính năng Bulk Import JSON.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                      {exam.source || 'TOEIC'} {exam.year || ''}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        exam.status === 'Published'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {exam.status}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 line-clamp-2">{exam.title}</h3>

                  <div className="flex items-center gap-4 mt-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      {exam.durationMinutes} phút
                    </span>
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-slate-400" />
                      {exam.totalQuestions} câu hỏi
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedExam(exam);
                    setMode(0);
                    setCustomMinutes(exam.durationMinutes);
                    setStartError('');
                  }}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  Vào phòng thi
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal chọn chế độ thi */}
      {selectedExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedExam.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">Chọn chế độ làm bài phù hợp với bạn</p>
              </div>
              <button
                onClick={() => setSelectedExam(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {startError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">
                {startError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={() => setMode(0)}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  mode === 0 ? 'border-indigo-600 bg-indigo-50/60' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-semibold text-slate-900 text-sm">Full Test</div>
                <div className="text-xs text-slate-500 mt-1">
                  Làm trọn bộ {selectedExam.totalQuestions} câu ({selectedExam.durationMinutes} phút)
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode(1)}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  mode === 1 ? 'border-indigo-600 bg-indigo-50/60' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                  Luyện theo Part
                </div>
                <div className="text-xs text-slate-500 mt-1">Tự chọn các Part và thời gian</div>
              </button>
            </div>

            {mode === 1 && (
              <div className="mb-5 space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
                    Chọn các Part muốn luyện
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                      <label
                        key={p}
                        className="flex items-center gap-2 text-sm text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-200 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedParts.includes(p)}
                          onChange={() => togglePart(p)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{PART_LABELS[p]}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Thời gian làm bài (phút)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(Number(e.target.value))}
                    className="w-32 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedExam(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={starting || (mode === 1 && selectedParts.length === 0)}
                onClick={handleStartAttempt}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white cursor-pointer"
              >
                {starting ? 'Đang tạo phòng thi...' : 'Bắt đầu làm bài'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
