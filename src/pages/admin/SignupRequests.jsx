import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

const TABS = [
  { key: 'REQUESTED', label: '승인 대기' },
  { key: 'REJECTED', label: '거절됨' },
];

export default function AdminSignupRequests() {
  const [tab, setTab] = useState('REQUESTED');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ content: [], totalPages: 1, first: true, last: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    const isEmail = keyword.includes('@');
    api.searchUsers(
      {
        signupStatus: tab,
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
  useEffect(load, [tab, page]);

  const search = (e) => {
    e.preventDefault();
    setPage(0);
    load();
  };

  const approve = async (id) => {
    setBusyId(id);
    setError('');
    try {
      await api.approveSignup(id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id) => {
    setBusyId(id);
    setError('');
    try {
      await api.rejectSignup(id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">회원가입 승인</div>
      </div>

      <div className="chip-row" style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`filter-chip${tab === t.key ? ' active' : ''}`}
            onClick={() => { setTab(t.key); setPage(0); }}
          >
            {t.label}
          </button>
        ))}
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

      {data.content.map((u) => (
        <div className="list-row-inline" key={u.id}>
          <div style={{ flex: 1 }}>
            <div className="team-name">{u.nickName}</div>
            <div className="team-time">{u.email} · 신청일 {new Date(u.createdAt).toLocaleDateString('ko-KR')}</div>
          </div>
          {tab === 'REQUESTED' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-primary btn-sm" disabled={busyId === u.id} onClick={() => approve(u.id)}>승인</button>
              <button className="btn btn-ghost btn-sm" disabled={busyId === u.id} onClick={() => reject(u.id)}>거절</button>
            </div>
          )}
          {tab === 'REJECTED' && (
            <button className="btn btn-ghost btn-sm" disabled={busyId === u.id} onClick={() => approve(u.id)}>
              승인으로 되돌리기
            </button>
          )}
        </div>
      ))}

      {data.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button className="btn btn-sm" disabled={data.first} onClick={() => setPage((p) => p - 1)}>이전</button>
          <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
            {page + 1} / {data.totalPages}
          </span>
          <button className="btn btn-sm" disabled={data.last} onClick={() => setPage((p) => p + 1)}>다음</button>
        </div>
      )}
    </div>
  );
}
