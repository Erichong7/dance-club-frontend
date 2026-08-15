import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';

const initialForm = { name: '', performanceDate: '', description: '' };
const ROLE_LABEL = { LEADER: '팀장', DEPUTY: '부팀장', MEMBER: '팀원' };

// 닉네임/이메일로 승인된 회원을 검색해 고르는 자동완성 입력. 검색창이 비어 있을 때 포커스하면
// 승인된 전체 멤버를 보여주고(loadAll), 타이핑을 시작하면 GET /api/users/search(APPROVED 전용)를
// 300ms 디바운스로 호출해 필터링한다. 결과에는 사용자 ID를 노출하지 않는다.
function MemberSearch({ onPick, disabled }) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const wrapRef = useRef(null);
  const latestKeyword = useRef(keyword);
  latestKeyword.current = keyword;

  useEffect(() => {
    if (!keyword.trim()) {
      setResults([]);
      setSearched(false);
      setError('');
      return;
    }
    const isEmail = keyword.includes('@');
    setSearching(true);
    const timer = setTimeout(() => {
      api.searchUsers(
        { signupStatus: 'APPROVED', nickname: isEmail ? undefined : keyword, email: isEmail ? keyword : undefined },
        { size: 5 }
      )
        .then((page) => {
          if (latestKeyword.current !== keyword) return; // 응답이 늦게 도착한 이전 검색이면 무시
          setResults(page.content ?? []);
          setError('');
        })
        .catch((err) => {
          if (latestKeyword.current !== keyword) return;
          setResults([]);
          setError(err.message);
        })
        .finally(() => {
          if (latestKeyword.current !== keyword) return;
          setSearching(false);
          setSearched(true);
          setOpen(true);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const loadAll = () => {
    if (keyword.trim() || searched || searching) return;
    setSearching(true);
    api.searchUsers({ signupStatus: 'APPROVED' }, { size: 50 })
      .then((page) => {
        setResults(page.content ?? []);
        setError('');
      })
      .catch((err) => {
        setResults([]);
        setError(err.message);
      })
      .finally(() => {
        setSearching(false);
        setSearched(true);
        setOpen(true);
      });
  };

  const handleFocus = () => {
    if (results.length > 0 || searched) {
      setOpen(true);
    } else {
      loadAll();
    }
  };

  const pick = (u) => {
    onPick(u);
    setKeyword('');
    setResults([]);
    setSearched(false);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }} ref={wrapRef}>
      <input
        className="form-input"
        placeholder="닉네임 또는 이메일로 검색"
        value={keyword}
        disabled={disabled}
        onChange={(e) => setKeyword(e.target.value)}
        onFocus={handleFocus}
      />
      {open && (searching || searched) && (
        <div
          className="room-picker-panel"
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, maxHeight: 260, overflowY: 'auto' }}
        >
          {searching && (
            <div className="room-picker-row" style={{ color: 'var(--color-text-tertiary)', fontSize: 11.5 }}>검색 중…</div>
          )}
          {!searching && error && (
            <div className="room-picker-row" style={{ color: '#9C1F27', fontSize: 11.5 }}>⚠ {error}</div>
          )}
          {!searching && !error && results.length === 0 && (
            <div className="room-picker-row" style={{ color: 'var(--color-text-tertiary)', fontSize: 11.5 }}>검색 결과가 없습니다.</div>
          )}
          {!searching && !error && results.map((u) => (
            <div
              key={u.id}
              className="room-picker-row"
              style={{ cursor: 'pointer' }}
              onClick={() => pick(u)}
            >
              <span className="room-picker-name">{u.nickName}</span>
              <span className="room-picker-email">{u.email}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 공연 상세 화면에 인라인으로 들어가는 팀 관리 행. 클릭하면 펼쳐지며, 펼칠 때만
// api.getTeam으로 멤버 목록을 지연 로드한다 (PerformanceResponse.teams에는 멤버가 없음).
function TeamRow({ team, onChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const [role, setRole] = useState('MEMBER');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadDetail = () => {
    api.getTeam(team.id).then(setDetail).catch((err) => setError(err.message));
  };

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !detail) loadDetail();
  };

  const removeTeam = async (e) => {
    e.stopPropagation();
    setError('');
    try {
      await api.deleteTeam(team.id);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const addMember = async (userId) => {
    setSaving(true);
    setError('');
    try {
      await api.addTeamMember(team.id, userId, role);
      loadDetail();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (targetUserId, role) => {
    setError('');
    try {
      await api.updateTeamMemberRole(team.id, targetUserId, role);
      loadDetail();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeMember = async (targetUserId) => {
    setError('');
    try {
      await api.removeTeamMember(team.id, targetUserId);
      loadDetail();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="notice-row" style={{ cursor: 'pointer' }} onClick={toggle}>
        <div>
          <div className="notice-title">{team.name}</div>
          <div className="notice-meta">생성일 {new Date(team.createdAt).toLocaleDateString('ko-KR')}</div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={removeTeam}>삭제</button>
      </div>

      {expanded && (
        <div style={{ padding: '12px 4px 4px' }}>
          {error && <div className="validation-msg validation-err">⚠ {error}</div>}
          {!detail && !error && <p style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>불러오는 중…</p>}

          {detail && (
            <>
              <div style={{ marginBottom: 16 }}>
                {detail.members.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>팀원이 없습니다.</p>}
                {detail.members.map((m) => (
                  <div className="list-row-inline" key={m.id}>
                    <div className="list-row-main">
                      <div className="team-name">{m.nickname}</div>
                      <div className="team-time">user #{m.userId}</div>
                    </div>
                    <select className="form-select role-select" value={m.role} onChange={(e) => changeRole(m.userId, e.target.value)}>
                      {Object.keys(ROLE_LABEL).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                    <button className="btn btn-ghost btn-sm" onClick={() => removeMember(m.userId)}>제거</button>
                  </div>
                ))}
              </div>

              <div className="rule-box">
                <div className="rule-box-title">팀원 추가</div>
                <p style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
                  닉네임 또는 이메일로 검색해 추가할 멤버를 클릭하세요. 검색창을 누르면 가입 승인된 전체 멤버가 보입니다.
                </p>
                <div className="member-add-row">
                  <div className="member-add-input">
                    <MemberSearch onPick={(u) => addMember(u.id)} disabled={saving} />
                  </div>
                  <select
                    className="form-select role-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    {Object.keys(ROLE_LABEL).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </div>
                {saving && (
                  <p style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginTop: 6 }}>추가 중…</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PerformanceList() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.getPerformances()
      .then((data) => setList([...data].sort((a, b) => b.performanceDate.localeCompare(a.performanceDate))))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const create = async () => {
    if (!form.name || !form.performanceDate) return;
    setSaving(true);
    setError('');
    try {
      await api.createPerformance({
        name: form.name,
        performanceDate: form.performanceDate,
        description: form.description || undefined,
      });
      setForm(initialForm);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    setError('');
    try {
      await api.deletePerformance(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="card" style={{ maxWidth: 620, marginBottom: 18 }}>
        <div className="card-header"><div className="card-title">공연 등록</div></div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">공연명</label>
            <input className="form-input" value={form.name} onChange={update('name')} placeholder="예: 2026 봄 정기공연" />
          </div>
          <div className="form-group">
            <label className="form-label">공연 날짜</label>
            <input className="form-input" type="date" value={form.performanceDate} onChange={update('performanceDate')} />
          </div>
          <div className="form-group full">
            <label className="form-label">설명 (선택)</label>
            <input className="form-input" value={form.description} onChange={update('description')} />
          </div>
        </div>
        {error && <div className="validation-msg validation-err">⚠ {error}</div>}
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-primary btn-sm" disabled={saving || !form.name || !form.performanceDate} onClick={create}>
            {saving ? '등록 중…' : '공연 등록'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">공연 목록</div></div>
        {loading && <p style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>불러오는 중…</p>}
        {!loading && list.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>등록된 공연이 없습니다.</p>}
        {list.map((p) => (
          <div className="sched-row" key={p.id} style={{ alignItems: 'center' }}>
            <Link to={`/admin/performances/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}>
              <div className="team-name">{p.name}</div>
              <div className="team-time">{p.performanceDate}{p.description ? ` · ${p.description}` : ''}</div>
            </Link>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => remove(p.id)}>삭제</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PerformanceDetail({ id }) {
  const [performance, setPerformance] = useState(null);
  const [error, setError] = useState('');
  const [teamName, setTeamName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.getPerformance(id).then(setPerformance).catch((err) => setError(err.message));
  };

  useEffect(load, [id]);

  const addTeam = async () => {
    if (!teamName) return;
    setSaving(true);
    setError('');
    try {
      await api.createTeam(teamName, id);
      setTeamName('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (error && !performance) return <div className="card"><div className="validation-msg validation-err">⚠ {error}</div></div>;
  if (!performance) return <div className="card">불러오는 중…</div>;

  return (
    <div className="card" style={{ maxWidth: 620 }}>
      <div className="card-header">
        <Link to="/admin/performances" className="btn btn-ghost btn-sm">← 공연 목록</Link>
        <div className="card-title" style={{ margin: 0 }}>{performance.name}</div>
      </div>
      <div className="team-time" style={{ marginBottom: 16 }}>
        {performance.performanceDate}{performance.description ? ` · ${performance.description}` : ''}
      </div>

      {error && <div className="validation-msg validation-err">⚠ {error}</div>}

      <div style={{ marginBottom: 16 }}>
        {(!performance.teams || performance.teams.length === 0) && (
          <p style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>등록된 팀이 없습니다.</p>
        )}
        {performance.teams?.map((t) => (
          <TeamRow key={t.id} team={t} onChanged={load} />
        ))}
      </div>

      <div className="rule-box">
        <div className="rule-box-title">팀 추가</div>
        <p style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
          이 공연 하위에 새 팀을 만듭니다. 팀을 클릭하면 팀원을 바로 관리할 수 있습니다.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input" placeholder="팀 이름" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
          <button className="btn btn-primary btn-sm" disabled={saving || !teamName} onClick={addTeam}>
            {saving ? '추가 중…' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPerformances() {
  const { id } = useParams();
  return id ? <PerformanceDetail id={id} /> : <PerformanceList />;
}
