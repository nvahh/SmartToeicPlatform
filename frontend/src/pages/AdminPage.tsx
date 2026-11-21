import { useEffect, useState, type ChangeEvent } from 'react';
import {
  Check,
  Copy,
  FileJson,
  Headphones,
  Image as ImageIcon,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { api, extractErrorMessage, resolveMediaUrl } from '../lib/api';
import type { ExamSummary } from '../types/api';

interface AdminQuestionGroup {
  id: string;
  partNumber: number;
  orderIndex: number;
  audioUrl?: string | null;
  imageUrl?: string | null;
  questions: { id: string; questionNumber: number; content?: string | null }[];
}

interface AdminExamDetail {
  id: string;
  title: string;
  questionGroups: AdminQuestionGroup[];
}

const SAMPLE_IMPORT_JSON = JSON.stringify(
  {
    title: 'ETS TOEIC 2026 - Practice Test 02',
    year: 2026,
    source: 'ETS',
    durationMinutes: 45,
    publishImmediately: true,
    questionGroups: [
      {
        partNumber: 5,
        orderIndex: 1,
        questions: [
          {
            questionNumber: 101,
            content: 'All employees are required to attend the safety seminar _______ Monday.',
            optionA: 'on',
            optionB: 'in',
            optionC: 'at',
            optionD: 'to',
            correctOption: 'A',
            explanation: 'Dùng giới từ "on" trước các thứ trong tuần.',
            difficultyLevel: 2,
            tagNames: ['Part 5 - Liên từ & Giới từ'],
          },
        ],
      },
    ],
  },
  null,
  2
);

export function AdminPage() {
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [jsonInput, setJsonInput] = useState(SAMPLE_IMPORT_JSON);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  // State cho Modal chỉnh sửa Media của đề thi đã tạo
  const [editingExam, setEditingExam] = useState<AdminExamDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [mediaDrafts, setMediaDrafts] = useState<Record<string, { audioUrl: string; imageUrl: string }>>({});
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);
  const [uploadingGroupKey, setUploadingGroupKey] = useState<string | null>(null);
  const [savedGroupMap, setSavedGroupMap] = useState<Record<string, boolean>>({});

  const fetchExams = async () => {
    setLoading(true);
    try {
      const res = await api.get<ExamSummary[]>('/Exams');
      setExams(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchExams();
  }, []);

  const handleToggleStatus = async (exam: ExamSummary) => {
    const nextStatus = exam.status === 'Published' ? 0 : 1;
    try {
      await api.patch(`/Exams/${exam.id}/status`, { status: nextStatus });
      await fetchExams();
    } catch (err) {
      alert(extractErrorMessage(err, 'Không thể đổi trạng thái đề thi.'));
    }
  };

  const handleDeleteExam = async (exam: ExamSummary) => {
    if (!window.confirm(`Xác nhận xóa mềm đề thi "${exam.title}"?`)) return;
    try {
      await api.delete(`/Exams/${exam.id}`);
      await fetchExams();
    } catch (err) {
      alert(extractErrorMessage(err, 'Không thể xóa đề thi.'));
    }
  };

  const handleOpenMediaEditor = async (examId: string) => {
    setLoadingDetail(true);
    setSavedGroupMap({});
    try {
      const res = await api.get<AdminExamDetail>(`/Exams/${examId}`);
      setEditingExam(res.data);
      const drafts: Record<string, { audioUrl: string; imageUrl: string }> = {};
      for (const g of res.data.questionGroups) {
        drafts[g.id] = {
          audioUrl: g.audioUrl ?? '',
          imageUrl: g.imageUrl ?? '',
        };
      }
      setMediaDrafts(drafts);
    } catch (err) {
      alert(extractErrorMessage(err, 'Không thể tải danh sách nhóm câu hỏi.'));
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleGroupMediaUpload = async (
    groupId: string,
    field: 'audioUrl' | 'imageUrl',
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const key = `${groupId}_${field}`;
    setUploadingGroupKey(key);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post<{ url: string }>('/Media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMediaDrafts((prev) => ({
        ...prev,
        [groupId]: {
          ...(prev[groupId] ?? { audioUrl: '', imageUrl: '' }),
          [field]: res.data.url,
        },
      }));
      setSavedGroupMap((prev) => ({ ...prev, [groupId]: false }));
    } catch (err) {
      alert(extractErrorMessage(err, 'Tải file lên thất bại.'));
    } finally {
      setUploadingGroupKey(null);
      e.target.value = '';
    }
  };

  const handleSaveGroupMedia = async (groupId: string) => {
    const draft = mediaDrafts[groupId];
    if (!draft) return;
    setSavingGroupId(groupId);
    try {
      await api.patch(`/Exams/groups/${groupId}/media`, {
        audioUrl: draft.audioUrl.trim() || null,
        imageUrl: draft.imageUrl.trim() || null,
      });
      setSavedGroupMap((prev) => ({ ...prev, [groupId]: true }));
    } catch (err) {
      alert(extractErrorMessage(err, 'Lưu Media thất bại.'));
    } finally {
      setSavingGroupId(null);
    }
  };

  const handleBulkImport = async () => {
    setImportMsg(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonInput);
    } catch {
      setImportMsg({ type: 'err', text: 'JSON sai cú pháp. Vui lòng kiểm tra lại dấu ngoặc và dấu phẩy.' });
      return;
    }

    setImporting(true);
    try {
      const res = await api.post<{ title: string }>('/Exams/bulk-import', parsed);
      setImportMsg({ type: 'ok', text: `Import thành công đề thi: "${res.data.title}"!` });
      await fetchExams();
    } catch (err) {
      setImportMsg({ type: 'err', text: extractErrorMessage(err, 'Bulk Import thất bại.') });
    } finally {
      setImporting(false);
    }
  };

  const handleUploadFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr('');
    setUploadedUrl('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post<{ url: string }>('/Media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadedUrl(res.data.url);
    } catch (err) {
      setUploadErr(extractErrorMessage(err, 'Tải file lên thất bại.'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const copyUrl = async () => {
    if (!uploadedUrl) return;
    await navigator.clipboard.writeText(uploadedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-indigo-600" />
            Trang Quản trị Ngân hàng Đề thi
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý xuất bản đề thi, chỉnh sửa Audio/Ảnh trực tiếp theo nhóm câu hỏi và Bulk Import JSON
          </p>
        </div>

        {/* Bảng danh sách đề thi */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Danh sách đề thi ({exams.length})</h2>
            <button
              type="button"
              onClick={() => void fetchExams()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tải lại
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Đang tải danh sách đề thi...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs uppercase text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Tiêu đề</th>
                    <th className="px-4 py-3">Nguồn / Năm</th>
                    <th className="px-4 py-3">Số câu</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-6 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {exams.map((exam) => (
                    <tr key={exam.id} className="hover:bg-slate-50/70">
                      <td className="px-6 py-3.5 font-semibold text-slate-900">{exam.title}</td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {exam.source || '-'} {exam.year || ''}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">{exam.totalQuestions} câu</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            exam.status === 'Published'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {exam.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          disabled={loadingDetail}
                          onClick={() => void handleOpenMediaEditor(exam.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold cursor-pointer"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          Sửa Media
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleStatus(exam)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          {exam.status === 'Published' ? 'Chuyển Nháp' : 'Xuất bản'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteExam(exam)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-medium cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Upload Media độc lập + Bulk Import JSON */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              Upload Audio / Hình ảnh
            </h2>
            <p className="text-xs text-slate-500">
              Hỗ trợ <code>.mp3, .wav, .m4a, .jpg, .png, .webp</code> (tối đa 25MB). Copy đường dẫn
              trả về để dán vào JSON.
            </p>

            <label className="block w-full border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-6 text-center cursor-pointer transition-colors">
              <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
              <div className="text-sm font-medium text-slate-700">
                {uploading ? 'Đang tải file lên...' : 'Chọn file Audio hoặc Ảnh từ máy'}
              </div>
              <input
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,.jpg,.jpeg,.png,.webp"
                disabled={uploading}
                onChange={(e) => void handleUploadFile(e)}
                className="hidden"
              />
            </label>

            {uploadErr && <div className="text-xs text-rose-600">{uploadErr}</div>}

            {uploadedUrl && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="text-xs font-semibold text-emerald-800">Upload thành công!</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={uploadedUrl}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => void copyUrl()}
                    className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Đã copy' : 'Copy'}
                  </button>
                </div>
                {uploadedUrl.includes('/images/') && (
                  <img
                    src={resolveMediaUrl(uploadedUrl)}
                    alt="Uploaded preview"
                    className="max-h-36 rounded-lg border border-emerald-200 mx-auto"
                  />
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileJson className="w-5 h-5 text-indigo-600" />
                Bulk Import Đề thi (JSON)
              </h2>
              <button
                type="button"
                onClick={() => setJsonInput(SAMPLE_IMPORT_JSON)}
                className="text-xs font-medium text-indigo-600 hover:underline cursor-pointer"
              >
                Khôi phục JSON mẫu
              </button>
            </div>

            <textarea
              rows={14}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-slate-300 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {importMsg && (
              <div
                className={`p-3 rounded-xl text-sm ${
                  importMsg.type === 'ok'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-700'
                }`}
              >
                {importMsg.text}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={importing}
                onClick={() => void handleBulkImport()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer"
              >
                {importing ? 'Đang nạp vào SQL Server...' : 'Import đề thi ngay'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Chỉnh sửa Audio / Ảnh trực tiếp cho từng nhóm câu hỏi */}
      {editingExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Chỉnh sửa Audio & Hình ảnh: {editingExam.title}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tải file trực tiếp hoặc dán đường dẫn rồi bấm &quot;Lưu Media&quot; cho từng nhóm
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingExam(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {editingExam.questionGroups.map((group) => {
                const draft = mediaDrafts[group.id] ?? { audioUrl: '', imageUrl: '' };
                const firstQ = group.questions[0]?.questionNumber;
                const lastQ = group.questions[group.questions.length - 1]?.questionNumber;
                const qRange = firstQ === lastQ ? `Câu ${firstQ}` : `Câu ${firstQ} - ${lastQ}`;
                const isSaved = savedGroupMap[group.id];

                return (
                  <div
                    key={group.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                          Part {group.partNumber}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">{qRange}</span>
                      </div>

                      <button
                        type="button"
                        disabled={savingGroupId === group.id}
                        onClick={() => void handleSaveGroupMedia(group.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                          isSaved
                            ? 'bg-emerald-600 text-white'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                      >
                        {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                        {savingGroupId === group.id
                          ? 'Đang lưu...'
                          : isSaved
                            ? 'Đã lưu'
                            : 'Lưu Media'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Audio URL */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                          <Headphones className="w-3.5 h-3.5 text-indigo-600" /> Audio URL
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={draft.audioUrl}
                            onChange={(e) => {
                              setMediaDrafts((prev) => ({
                                ...prev,
                                [group.id]: { ...draft, audioUrl: e.target.value },
                              }));
                              setSavedGroupMap((prev) => ({ ...prev, [group.id]: false }));
                            }}
                            placeholder="/uploads/audio/..."
                            className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                          />
                          <label className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-700 cursor-pointer shrink-0">
                            {uploadingGroupKey === `${group.id}_audioUrl` ? '...' : 'Upload'}
                            <input
                              type="file"
                              accept=".mp3,.wav,.m4a,.ogg"
                              className="hidden"
                              onChange={(e) => void handleGroupMediaUpload(group.id, 'audioUrl', e)}
                            />
                          </label>
                        </div>
                        {draft.audioUrl && (
                          <audio
                            key={draft.audioUrl}
                            controls
                            src={resolveMediaUrl(draft.audioUrl)}
                            className="w-full h-8"
                          />
                        )}
                      </div>

                      {/* Image URL */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5 text-indigo-600" /> Image URL
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={draft.imageUrl}
                            onChange={(e) => {
                              setMediaDrafts((prev) => ({
                                ...prev,
                                [group.id]: { ...draft, imageUrl: e.target.value },
                              }));
                              setSavedGroupMap((prev) => ({ ...prev, [group.id]: false }));
                            }}
                            placeholder="/uploads/images/..."
                            className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                          />
                          <label className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-700 cursor-pointer shrink-0">
                            {uploadingGroupKey === `${group.id}_imageUrl` ? '...' : 'Upload'}
                            <input
                              type="file"
                              accept=".jpg,.jpeg,.png,.webp"
                              className="hidden"
                              onChange={(e) => void handleGroupMediaUpload(group.id, 'imageUrl', e)}
                            />
                          </label>
                        </div>
                        {draft.imageUrl && (
                          <img
                            src={resolveMediaUrl(draft.imageUrl)}
                            alt={`Part ${group.partNumber} preview`}
                            className="h-24 rounded-lg border border-slate-200 object-contain bg-white"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
