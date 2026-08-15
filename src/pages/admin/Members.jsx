import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

const DELETE_USER_ERROR_MESSAGE = {
  SELF_DELETE_FORBIDDEN: '본인 계정은 삭제할 수 없습니다.',
};

export default function AdminMembers() {
  const { user } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ content: [], totalPages: 1, first: true, last: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    const isEmail = keyword.includes('@');
    api.searchUsers(
      {
        signupStatus: 'APPROVED',
        nickname: isEmail ? undefined : keyword || undefined,
        email: isEmail ? keyword : undefined,
      },
      { page, size: 10 }
    )
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [page]);

  const search = (e) => {
    e.preventDefault();
    setPage(0);
    load();
  };

  const openDeleteModal = (u) => {
    setDeleteTarget(u);
    setDeleteError('');
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setDeleteError(DELETE_USER_ERROR_MESSAGE[err.code] || err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">회원 관리</div>
      </div>

      <form onSubmit={search} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          className="form-input"
          placeholder="닉네임 또는 이메일로 검색"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <button className="btn btn-sm" type="submit">검색</button>
      </form>

      {error && <div className="validation-msg validation-err">⚠ {error}</div>}
      {loading && <p style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>불러오는 중…</p>}
      {!loading && data.content.length === 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>해당하는 회원이 없습니다.</p>
      )}

      {data.content.map((u) => {
        const isSelf = u.id === user?.id;
        return (
          <div className="list-row-inline" key={u.id}>
            <div style={{ flex: 1 }}>
              <div className="team-name">
                {u.nickName}{' '}
                <span className={`badge ${u.role === 'ADMIN' ? 'badge-notice' : 'badge-gray'}`}>
                  {u.role === 'ADMIN' ? '관리자' : '일반회원'}
                </span>
              </div>
              <div className="team-time">
                {u.email} · {u.phoneNumber} · 가입일 {new Date(u.createdAt).toLocaleDateString('ko-KR')}
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              disabled={isSelf}
              title={isSelf ? '본인 계정은 삭제할 수 없습니다' : undefined}
              onClick={() => openDeleteModal(u)}
            >
              삭제
            </button>
          </div>
        );
      })}

      {data.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button className="btn btn-sm" disabled={data.first} onClick={() => setPage((p) => p - 1)}>이전</button>
          <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
            {page + 1} / {data.totalPages}
          </span>
          <button className="btn btn-sm" disabled={data.last} onClick={() => setPage((p) => p + 1)}>다음</button>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-bg" onClick={closeDeleteModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">회원 삭제</div>
              <button className="modal-close" onClick={closeDeleteModal}>✕</button>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              <strong>{deleteTarget.nickName}</strong>({deleteTarget.email}) 님을 정말 삭제하시겠습니까?
              <br />
              게시글·연습 신청·팀 멤버십이 함께 삭제되며 되돌릴 수 없습니다.
            </p>
            {deleteError && <div className="validation-msg validation-err" style={{ marginBottom: 12 }}>⚠ {deleteError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" disabled={deleting} onClick={closeDeleteModal}>취소</button>
              <button className="btn btn-danger btn-sm" disabled={deleting} onClick={confirmDelete}>
                {deleting ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
