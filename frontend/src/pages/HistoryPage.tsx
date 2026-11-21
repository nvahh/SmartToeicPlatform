import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Award, Calendar, PlayCircle, Save, TrendingUp, UserCheck } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { api, extractErrorMessage } from '../lib/api';
import type { AttemptSummary } from '../types/api';

export function HistoryPage() {
  const { user, refreshProfile } = useAuth();
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [targetScore, setTargetScore] = useState(user?.targetScore ? String(user.targetScore) : '750');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  useEffect(() => {
    setFullName(user?.fullName ?? '');
    setTargetScore(user?.targetScore ? String(user.targetScore) : '');
  }, [user]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get<AttemptSummary[]>('/Attempts');
        if (active) setAttempts(res.data);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const completedAttempts = useMemo(
    () => attempts.filter((a) => a.status === 'Completed'),
    [attempts]
  );

  const chartData = useMemo(() => {
    return [...completedAttempts]
      .reverse()
      .map((a, idx) => ({
        name: `Lần ${idx + 1}`,
        total: a.totalScore,
        listening: a.listeningScore,
        reading: a.readingScore,
      }));
  }, [completedAttempts]);

  const bestScore = useMemo(
    () => completedAttempts.reduce((max, a) => Math.max(max, a.totalScore), 0),
    [completedAttempts]
  );

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg('');
    try {
      await api.put('/Auth/me', {
        fullName,
        targetScore: targetScore ? Number(targetScore) : null,
      });
      await refreshProfile();
      setProfileMsg('Đã cập nhật hồ sơ thành công.');
    } catch (err) {
      setProfileMsg(extractErrorMessage(err, 'Cập nhật thất bại.'));
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Biểu đồ tiến bộ điểm TOEIC */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  Biểu đồ tiến bộ điểm TOEIC
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Điểm cao nhất: <strong className="text-indigo-600">{bestScore} / 990</strong> • Đã
                  hoàn thành <strong>{completedAttempts.length}</strong> bài thi
                </p>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-sm text-slate-400">
                Hoàn thành ít nhất 1 bài thi để xem biểu đồ tiến bộ điểm số.
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 990]} tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', borderColor: '#e2e8f0' }} />
                    {user?.targetScore && (
                      <ReferenceLine
                        y={user.targetScore}
                        stroke="#10b981"
                        strokeDasharray="5 5"
                        label={{ value: `Mục tiêu ${user.targetScore}`, fill: '#059669', fontSize: 11 }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Tổng điểm"
                      stroke="#4f46e5"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Cập nhật hồ sơ & mục tiêu điểm */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              Hồ sơ học tập
            </h2>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                <input
                  type="text"
                  disabled
                  value={user?.email ?? ''}
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Họ và tên</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Mục tiêu điểm TOEIC (10 - 990)
                </label>
                <input
                  type="number"
                  min={10}
                  max={990}
                  step={5}
                  value={targetScore}
                  onChange={(e) => setTargetScore(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {profileMsg && <div className="text-xs font-medium text-indigo-700">{profileMsg}</div>}

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </form>
          </div>
        </div>

        {/* Bảng lịch sử tất cả lượt làm bài */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">Lịch sử làm bài gần đây</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Đang tải lịch sử...</div>
          ) : attempts.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <Award className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="text-sm text-slate-500">Bạn chưa làm bài thi nào.</div>
              <Link
                to="/exams"
                className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
              >
                Bắt đầu làm đề đầu tiên
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Đề thi</th>
                    <th className="px-4 py-3">Chế độ</th>
                    <th className="px-4 py-3">Thời gian</th>
                    <th className="px-4 py-3">Điểm (LC / RC / Tổng)</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-6 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attempts.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/70">
                      <td className="px-6 py-4 font-semibold text-slate-900">{a.examTitle}</td>
                      <td className="px-4 py-4 text-slate-600">
                        {a.mode}
                        {a.selectedParts ? ` (P${a.selectedParts})` : ''}
                      </td>
                      <td className="px-4 py-4 text-slate-500 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(a.startedAt).toLocaleString('vi-VN')}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {a.status === 'Completed' ? (
                          <span>
                            {a.listeningScore} / {a.readingScore} /{' '}
                            <strong className="text-indigo-700">{a.totalScore}</strong>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            a.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {a.status === 'Completed' ? 'Hoàn thành' : 'Đang làm dở'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {a.status === 'Completed' ? (
                          <Link
                            to={`/result/${a.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-xs"
                          >
                            Xem kết quả
                          </Link>
                        ) : (
                          <Link
                            to={`/test/${a.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 font-semibold text-xs"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            Làm tiếp
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
