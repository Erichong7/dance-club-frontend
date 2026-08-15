import { NavLink, Link } from 'react-router-dom';
import BrandMark from './BrandMark.jsx';
import {
  IconDashboard,
  IconCalendar,
  IconPlus,
  IconBell,
  IconPhoto,
  IconClipboard,
  IconInbox,
  IconUser,
  IconUsers,
  IconLogout,
} from './Icons.jsx';
import { formatMyTeamNames } from '../utils/user.js';

// public: true인 메뉴는 백엔드가 로그인 없이도 응답하는 기능(GET /api/schedules, /api/posts)이라
// 비로그인 상태에서도 노출한다. 나머지는 개인화 데이터나 쓰기 작업이 필요해 로그인 후에만 보여준다.
const userNavItems = [
  { to: '/', label: '대시보드', icon: IconDashboard, end: true, public: false },
  { to: '/schedule', label: '연습 일정', icon: IconCalendar, public: true },
  { to: '/apply', label: '일정 신청', icon: IconPlus, public: false },
  { to: '/notice', label: '공지사항', icon: IconBell, public: true },
  { to: '/photo', label: '사진 게시판', icon: IconPhoto, public: false },
];

const adminNavItems = [
  { to: '/admin/requests', label: '신청 검토·배정', icon: IconInbox },
  { to: '/admin/performances', label: '공연 관리', icon: IconClipboard },
  { to: '/admin/signup-requests', label: '회원가입 승인', icon: IconUser },
  { to: '/admin/members', label: '회원 관리', icon: IconUsers },
];

export default function Sidebar({ user, isAdmin, onLogout, isOpen, onClose }) {
  return (
    <aside className={'sidebar' + (isOpen ? ' sidebar-open' : '')}>
      <div className="sidebar-brand">
        <BrandMark className="brand-mark" />
        <div className="brand-name">practice.zip</div>
        <div className="brand-sub">연습 일정 관리</div>
        <button type="button" className="sidebar-close-btn" onClick={onClose} aria-label="사이드바 닫기">
          ✕
        </button>
      </div>

      <nav className="nav-section">
        <div className="nav-label">메뉴</div>
        {(user ? userNavItems : userNavItems.filter((item) => item.public)).map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>

      {isAdmin && (
        <nav className="nav-section">
          <div className="nav-label">관리자</div>
          {adminNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
      )}

      {user ? (
        <div className="sidebar-user">
          <div className="avatar">{user.nickName?.[0] ?? '?'}</div>
          <div>
            <div className="user-name">{user.nickName ?? '알 수 없음'}</div>
            <div className="user-role">{isAdmin ? '관리자' : formatMyTeamNames(user)}</div>
          </div>
          <button className="logout-btn" onClick={onLogout} aria-label="로그아웃" title="로그아웃">
            <IconLogout />
          </button>
        </div>
      ) : (
        <div className="sidebar-user">
          <Link to="/login" className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
            로그인
          </Link>
        </div>
      )}
    </aside>
  );
}
