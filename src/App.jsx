import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Schedule from './pages/Schedule.jsx';
import Apply from './pages/Apply.jsx';
import Notice from './pages/Notice.jsx';
import Photo from './pages/Photo.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import AdminPerformances from './pages/admin/Performances.jsx';
import AdminRequests from './pages/admin/Requests.jsx';
import AdminSignupRequests from './pages/admin/SignupRequests.jsx';
import AdminMembers from './pages/admin/Members.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthed, isLoading, isAdmin, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 라우트가 바뀌면(메뉴 항목 클릭 등) 모바일 드로어를 자동으로 닫는다.
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  if (isLoading) {
    return <div className="login-screen">불러오는 중…</div>;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // /login, /signup은 로그인 여부와 무관하게 사이드바 없는 전체화면 카드 레이아웃을 쓴다.
  const isStandalone = location.pathname === '/login' || location.pathname === '/signup';
  if (isStandalone) {
    return (
      <Routes>
        <Route path="/login" element={isAuthed ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/signup" element={isAuthed ? <Navigate to="/" replace /> : <Signup />} />
      </Routes>
    );
  }

  // 그 외 경로는 로그인 여부와 무관하게 항상 Sidebar/Topbar 셸을 쓴다. 백엔드가 로그인
  // 없이 permitAll()로 열어둔 기능(연습 일정 조회, 공지사항)은 비로그인 상태에서도 그대로
  // 렌더하고, 개인화 데이터나 쓰기 작업이 필요한 나머지는 라우트별로 /login으로 돌려보낸다.
  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        isAdmin={isAdmin}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      {isSidebarOpen && <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />}
      <div className="main">
        <Topbar
          path={location.pathname}
          user={user}
          isAdmin={isAdmin}
          onLogout={handleLogout}
          onMenuClick={() => setIsSidebarOpen((v) => !v)}
        />
        <div className="content">
          <Routes>
            <Route path="/" element={isAuthed ? <Dashboard /> : <Navigate to="/schedule" replace />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/apply" element={isAuthed ? <Apply /> : <Navigate to="/login" replace />} />
            <Route path="/notice" element={<Notice />} />
            <Route path="/notice/:id" element={<Notice />} />
            <Route path="/photo" element={isAuthed ? <Photo /> : <Navigate to="/login" replace />} />
            {isAdmin && <Route path="/admin/requests" element={<AdminRequests />} />}
            {isAdmin && <Route path="/admin/signup-requests" element={<AdminSignupRequests />} />}
            {isAdmin && <Route path="/admin/members" element={<AdminMembers />} />}
            {isAdmin && <Route path="/admin/performances" element={<AdminPerformances />} />}
            {isAdmin && <Route path="/admin/performances/:id" element={<AdminPerformances />} />}
            <Route path="*" element={<Navigate to={isAuthed ? '/' : '/schedule'} replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
