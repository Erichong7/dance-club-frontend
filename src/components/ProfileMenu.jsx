import { useState, useRef, useEffect } from 'react';
import { IconUser, IconLogout } from './Icons.jsx';
import { formatMyTeamNames } from '../utils/user.js';

export default function ProfileMenu({ user, isAdmin, onLogout }) {
  const [open, setOpen] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  return (
    <div className="profile-menu" ref={wrapRef}>
      <button type="button" className="avatar profile-menu-trigger" onClick={() => setOpen((v) => !v)}>
        {user.nickName?.[0] ?? '?'}
      </button>

      {open && (
        <div className="profile-menu-panel">
          <button type="button" className="profile-menu-item" onClick={() => { setShowDetail(true); setOpen(false); }}>
            <IconUser /> 상세 정보
          </button>
          <button type="button" className="profile-menu-item" onClick={() => { setOpen(false); onLogout(); }}>
            <IconLogout /> 로그아웃
          </button>
        </div>
      )}

      {showDetail && (
        <div className="modal-bg" onClick={() => setShowDetail(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">상세 정보</div>
              <button className="modal-close" onClick={() => setShowDetail(false)}>✕</button>
            </div>
            <div className="receipt-table">
              <div className="receipt-row"><span className="k">닉네임</span><span className="v">{user.nickName}</span></div>
              <div className="receipt-row"><span className="k">이메일</span><span className="v">{user.email || '—'}</span></div>
              <div className="receipt-row"><span className="k">역할</span><span className="v">{isAdmin ? '관리자' : '일반 회원'}</span></div>
              <div className="receipt-row"><span className="k">소속팀</span><span className="v">{formatMyTeamNames(user)}</span></div>
            </div>
            {user.isFallback && (
              <p style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 10 }}>
                ⚠ 사용자 프로필 API(/api/auth/me) 연동 전이라 최소 정보만 표시됩니다.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
