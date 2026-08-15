import { useNavigate, Link } from 'react-router-dom';
import { IconPlus, IconMenu } from './Icons.jsx';
import ProfileMenu from './ProfileMenu.jsx';

const titles = {
  '/': '대시보드',
  '/schedule': '연습 일정',
  '/apply': '일정 신청',
  '/notice': '공지사항',
  '/photo': '사진 게시판',
  '/admin/requests': '신청 검토 · 배정',
  '/admin/signup-requests': '회원가입 승인',
  '/admin/performances': '공연 관리',
};

function titleFor(path) {
  if (titles[path]) return titles[path];
  if (path.startsWith('/notice/')) return '공지사항';
  return '';
}

export default function Topbar({ path, user, isAdmin, onLogout, onMenuClick }) {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <button type="button" className="hamburger-btn" onClick={onMenuClick} aria-label="메뉴 열기">
        <IconMenu />
      </button>
      <div className="topbar-title">{titleFor(path)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {user && !path.startsWith('/admin') && (
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/apply')}>
            <IconPlus width={14} height={14} /> 일정 신청
          </button>
        )}
        {user ? (
          <ProfileMenu user={user} isAdmin={isAdmin} onLogout={onLogout} />
        ) : (
          <Link to="/login" className="btn btn-primary btn-sm">로그인</Link>
        )}
      </div>
    </header>
  );
}
