import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { roomLabels } from '../api/mockData.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getMyTeams, formatMyTeamNames } from '../utils/user.js';
import { mondayOf, addDays, toISODate, dateOfAt, timeOfAt, isOvernightAt, DAY_LABELS } from '../utils/date.js';

const roomClass = {
  CLUB_ROOM: 'room-dong',
  CHEER_ROOM: 'room-cheer',
  STUDENT_UNION_BASEMENT: 'room-yellow',
  EXTERNAL: 'room-ext',
  UNDERGROUND_PARKING: 'room-parking',
};

export default function Dashboard() {
  const { user } = useAuth();
  const myTeams = getMyTeams(user);
  const teamIdsKey = myTeams.map((t) => t.id).join(',');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [performances, setPerformances] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamSchedules, setTeamSchedules] = useState([]);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.allSettled([
      api.getPerformances(),
      api.getTeams(),
      api.getPosts(0, 3),
      Promise.all(myTeams.map((t) => api.getTeamSchedules(t.id))),
    ]).then(([perfR, teamR, postR, schedR]) => {
      if (cancelled) return;
      if (perfR.status === 'fulfilled') setPerformances(perfR.value);
      if (teamR.status === 'fulfilled') setTeams(teamR.value);
      if (postR.status === 'fulfilled') setPosts(postR.value.content ?? []);
      if (schedR.status === 'fulfilled') setTeamSchedules(schedR.value.flatMap((page) => page.content ?? []));
      const failed = [perfR, teamR, postR, schedR].find((r) => r.status === 'rejected');
      if (failed) setError(failed.reason?.message || '일부 정보를 불러오지 못했습니다.');
      setLoading(false);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamIdsKey]);

  if (loading) return <div className="card">불러오는 중…</div>;

  const monday = mondayOf(new Date());
  const sunday = addDays(monday, 6);
  const thisWeekSchedules = teamSchedules
    .filter((s) => dateOfAt(s.startAt) >= toISODate(monday) && dateOfAt(s.startAt) <= toISODate(sunday))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const pendingCount = teamSchedules.filter((s) => s.status === 'PENDING').length;
  const upcomingPerformanceCount = performances.filter((p) => p.performanceDate >= toISODate(new Date())).length;

  return (
    <div>
      {error && <div className="validation-msg validation-err" style={{ marginBottom: 16 }}>⚠ {error}</div>}

      {myTeams.length === 0 && (
        <div className="validation-msg validation-err" style={{ marginBottom: 16 }}>
          ⚠ 아직 소속된 팀이 없습니다. 관리자에게 팀 배정을 요청해 주세요. (팀에 속해야 일정 신청이 가능합니다)
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">우리 팀 이번 주 일정</div>
          <div className="stat-value">{thisWeekSchedules.length}</div>
          <div className="stat-sub">{formatMyTeamNames(user)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">대기중인 우리 팀 신청</div>
          <div className="stat-value">{pendingCount}</div>
          <div className="stat-sub">관리자 승인 대기</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">다가오는 공연</div>
          <div className="stat-value">{upcomingPerformanceCount}</div>
          <div className="stat-sub">총 {performances.length}개 중</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">등록된 팀</div>
          <div className="stat-value">{teams.length}</div>
          <div className="stat-sub">전체 동아리</div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-header">
            <div className="card-title">이번 주 우리 팀 일정</div>
            <Link to="/schedule" className="btn btn-ghost btn-sm">전체 보기</Link>
          </div>
          {thisWeekSchedules.length === 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>이번 주 등록된 일정이 없습니다.</p>
          )}
          {thisWeekSchedules.map((s) => {
            const d = new Date(`${dateOfAt(s.startAt)}T00:00:00`);
            const dow = DAY_LABELS[(d.getDay() + 6) % 7];
            const room = s.assignedRoom;
            return (
              <div className="sched-row" key={s.id}>
                <div className={`sched-date-badge ${roomClass[room] ?? 'room-parking'}`}>
                  <span className="dow">{dow}</span>
                  <span className="dom">{d.getDate()}</span>
                </div>
                <div>
                  <div className="team-name">
                    {s.teamName}
                    {room ? (
                      <span className={`room-tag ${roomClass[room]}`}>{roomLabels[room]}</span>
                    ) : (
                      <span className="badge badge-info" style={{ marginLeft: 6 }}>배정 대기</span>
                    )}
                  </div>
                  <div className="team-time">
                    {timeOfAt(s.startAt)} – {timeOfAt(s.endAt)}{isOvernightAt(s.startAt, s.endAt) ? ' (익일)' : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">최근 공지</div>
            <Link to="/notice" className="btn btn-ghost btn-sm">전체 보기</Link>
          </div>
          {posts.length === 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>등록된 공지가 없습니다.</p>
          )}
          {posts.map((n) => (
            <Link to={`/notice/${n.id}`} className="notice-row" key={n.id} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div>
                <div className="notice-title">{n.title}</div>
                <div className="notice-meta">{n.nickname} · {new Date(n.createdAt).toLocaleDateString('ko-KR')}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
