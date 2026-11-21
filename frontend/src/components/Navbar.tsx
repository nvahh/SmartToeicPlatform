import { Link, NavLink, useNavigate } from 'react-router-dom';
import { BookOpen, Brain, GraduationCap, History, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/exams" className="flex items-center gap-2 font-bold text-lg text-indigo-600">
          <GraduationCap className="w-7 h-7" />
          <span>Smart TOEIC</span>
        </Link>

        {user && (
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/exams" className={navClass}>
              <BookOpen className="w-4 h-4" />
              Đề thi
            </NavLink>
            <NavLink to="/reviews" className={navClass}>
              <Brain className="w-4 h-4" />
              Ôn tập SM-2
            </NavLink>
            <NavLink to="/history" className={navClass}>
              <History className="w-4 h-4" />
              Lịch sử
            </NavLink>
            {user.role === 'Admin' && (
              <NavLink to="/admin" className={navClass}>
                <ShieldCheck className="w-4 h-4" />
                Quản trị
              </NavLink>
            )}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-slate-800">{user.fullName}</div>
                <div className="text-xs text-slate-500">
                  {user.role === 'Admin' ? 'Quản trị viên' : `Mục tiêu: ${user.targetScore ?? 'Chưa đặt'} điểm`}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-indigo-600">
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
