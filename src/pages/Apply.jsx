import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCheck, IconPlus } from '../components/Icons.jsx';
import TimeRangePicker from '../components/TimeRangePicker.jsx';
import { api } from '../api/client.js';
import { roomLabels } from '../api/mockData.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getMyTeams } from '../utils/user.js';
import { toBackendTime, dateOfAt, timeOfAt, isOvernightAt, mondayOf, addDays, toISODate } from '../utils/date.js';

const FIELD_KEYS = ['performanceId', 'teamId', 'date', 'room', 'start', 'end'];
// 예비 연습실은 외부 연습실/지하 주차장 2곳만 신청 가능 (roomOrder 전체 5개 중 일부만 노출).
const ALTERNATIVE_ROOM_OPTIONS = ['EXTERNAL', 'UNDERGROUND_PARKING'];
const ROLE_LABEL = { LEADER: '팀장', DEPUTY: '부팀장', MEMBER: '팀원' };

// 신청 규칙을 한 곳에 모아둔 순수 함수 — 백엔드 ScheduleService와 동일한 규칙을 프론트에서 미리 검증.
// 종료 시간이 시작 시간보다 이르면 에러가 아니라 익일 종료로 간주한다(ScheduleService.toOvernightAwareRange와 동일한 판정).
function validate(card) {
  const errors = [];
  if (!card.start || !card.end) return errors;

  const [sh, sm] = card.start.split(':').map(Number);
  const [eh, em] = card.end.split(':').map(Number);
  const startH = sh + sm / 60;
  const endH = eh + em / 60;

  if (startH === endH) {
    errors.push('시작 시간과 종료 시간이 같을 수 없습니다.');
    return errors; // 이후 검증은 의미 없으므로 중단
  }
  const duration = endH > startH ? endH - startH : endH - startH + 24;
  if (duration > 4) {
    errors.push('팀당 하루 최대 4시간까지만 신청 가능합니다.');
  }

  if (card.date && card.room === 'CHEER_ROOM') {
    const dayOfWeek = new Date(card.date).getDay(); // 0=일 ... 3=수
    if (dayOfWeek !== 3) {
      errors.push('치어룸은 수요일에만 신청 가능합니다.');
    } else if (card.start !== '18:30' || card.end !== '20:30') {
      errors.push('치어룸은 18:30~20:30 고정 시간에만 배정됩니다.');
    }
  }

  if (card.date && checkApplyWindow(card.date)) {
    errors.push('신청은 연습 예정일 전주 일요일까지 가능합니다.');
  }

  if (card.date && isTooFarInAdvance(card.date)) {
    errors.push('신청은 다음 주 일정만 가능합니다. 그 이후 주는 아직 신청 기간이 아닙니다.');
  }

  return errors;
}

// 연습일 기준 "전주 일요일"이 이미 지났는지 체크
function checkApplyWindow(dateStr) {
  const practiceDate = new Date(dateStr);
  const dayOfWeek = practiceDate.getDay();
  const diffToSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
  const deadline = new Date(practiceDate);
  deadline.setDate(practiceDate.getDate() - diffToSunday);
  deadline.setHours(23, 59, 59, 999);
  return new Date() > deadline;
}

// 신청 가능한 날짜 범위 — 이번 주는 항상 마감이라 "다음 주" 월~일만 열려있다
// (백엔드 validateDeadline: nextDeadline(오늘 기준 다음 일요일)보다 늦은 주는 SCHEDULE_TOO_FAR_IN_ADVANCE로 거부).
function applyDateRange() {
  const minDate = addDays(mondayOf(new Date()), 7); // 다음 주 월요일
  const maxDate = addDays(minDate, 6); // 다음 주 일요일
  return { min: toISODate(minDate), max: toISODate(maxDate) };
}

// 신청 가능 범위(다음 주)보다 뒤의 날짜인지 체크 — 문자열이 ISO(YYYY-MM-DD)라 사전식 비교로 충분.
function isTooFarInAdvance(dateStr) {
  return dateStr > applyDateRange().max;
}

// 팀은 특정 공연 하위로 등록되므로(PerformanceResponse.teams), 내 팀 중 그 공연에 실제로
// 속한 팀만 골라낸다 — 공연을 바꿔도 아무 팀이나 신청할 수 있던 문제를 막는다.
function teamsForPerformance(performances, performanceId, myTeams) {
  const perfTeamIds = new Set(
    (performances.find((p) => String(p.id) === String(performanceId))?.teams ?? []).map((t) => String(t.id))
  );
  return myTeams.filter((t) => perfTeamIds.has(String(t.id)));
}

function defaultTeamFor(performances, performanceId, myTeams) {
  const available = teamsForPerformance(performances, performanceId, myTeams);
  return available[0] ? String(available[0].id) : '';
}

// 연습실은 신청 시 "후보(alternativeRoom)" 한 칸만 지정할 수 있다 — ScheduleCreateRequest에
// 희망/예비 두 필드가 있는 게 아니라서(백엔드 스키마 재확인 완료), 칩 형태 단일 선택으로 받는다.
function RoomChips({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {ALTERNATIVE_ROOM_OPTIONS.map((key) => (
        <button
          type="button"
          key={key}
          className={`room-tag${value === key ? ' room-tag-active' : ''}`}
          onClick={() => onChange(key)}
        >
          {roomLabels[key]}
        </button>
      ))}
    </div>
  );
}

// 팀 내 역할(LEADER/DEPUTY/MEMBER)을 신청 전에 보여준다 — 팀장/부팀장만 신청이 가능하다는
// 제약을 제출 후 403으로 처음 알게 되는 대신 미리 알 수 있게 한다.
function RoleBadge({ role }) {
  if (!role) return <span style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>—</span>;
  return (
    <div>
      <span className={`badge ${role === 'MEMBER' ? 'badge-urgent' : 'badge-info'}`}>{ROLE_LABEL[role]}</span>
      {role === 'MEMBER' && (
        <div style={{ fontSize: 11, color: '#9C1F27', marginTop: 4 }}>
          ⚠ 팀장·부팀장만 신청할 수 있어요. 이 역할로는 신청이 거부될 수 있습니다.
        </div>
      )}
    </div>
  );
}

function RequestCard({ index, card, performances, myTeams, teamRoles, onChange, onRemove, removable }) {
  const errors = validate(card);
  const isComplete = FIELD_KEYS.every((k) => card[k] !== '');
  const update = (key) => (e) => onChange({ ...card, [key]: e.target.value });
  const role = card.teamId ? teamRoles[card.teamId] : null;
  const availableTeams = teamsForPerformance(performances, card.performanceId, myTeams);
  const { min: minDate, max: maxDate } = applyDateRange();

  const pickPerformance = (e) => {
    const performanceId = e.target.value;
    const nextAvailable = teamsForPerformance(performances, performanceId, myTeams);
    // 새 공연에 지금 선택된 팀이 없으면 다시 고르게 비운다.
    const teamId = nextAvailable.some((t) => String(t.id) === String(card.teamId)) ? card.teamId : '';
    onChange({ ...card, performanceId, teamId });
  };

  const pickRoom = (room) => {
    // 치어룸은 시간이 수요일 18:30~20:30으로 고정이라, 비어 있으면 바로 채워 직접 입력 실수를 줄인다.
    // validate()의 요일 검사는 그대로 남아있어 수요일이 아니면 여전히 에러가 뜬다.
    if (room === 'CHEER_ROOM' && !card.start && !card.end) {
      onChange({ ...card, room, start: '18:30', end: '20:30' });
    } else {
      onChange({ ...card, room });
    }
  };

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-header">
        <div className="req-card-label">신청 {index + 1}</div>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!removable} onClick={onRemove}
                style={!removable ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}>
          삭제
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">공연</label>
            <select className="form-select" value={card.performanceId} onChange={pickPerformance}>
              <option value="">선택하세요</option>
              {performances.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">팀</label>
            <select className="form-select" value={card.teamId} onChange={update('teamId')} disabled={!card.performanceId}>
              <option value="">선택하세요</option>
              {availableTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {card.performanceId && availableTeams.length === 0 && (
              <p style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>이 공연에 속한 팀이 없습니다.</p>
            )}
            <RoleBadge role={role} />
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">연습 날짜</label>
            <input className="form-input" type="date" min={minDate} max={maxDate} value={card.date} onChange={update('date')} />
          </div>
          <div className="form-group">
            <label className="form-label">연습 시간</label>
            <TimeRangePicker
              start={card.start}
              end={card.end}
              onChange={({ start, end }) => onChange({ ...card, start, end })}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">후보 연습실 (1곳 선택 · 최종 배정은 관리자가 진행)</label>
          <RoomChips value={card.room} onChange={pickRoom} />
        </div>
      </div>

      {isComplete && (
        errors.length > 0 ? (
          <div className="validation-msg validation-err">
            {errors.map((m) => <div key={m}>⚠ {m}</div>)}
          </div>
        ) : (
          <div className="validation-msg validation-ok">
            <IconCheck /> 신청 조건이 확인되었습니다.
          </div>
        )
      )}
    </div>
  );
}

export default function Apply() {
  const { user } = useAuth();
  const myTeams = getMyTeams(user);
  const navigate = useNavigate();
  const uidRef = useRef(0);

  const makeCard = (defaults = {}) => {
    uidRef.current += 1;
    return { uid: uidRef.current, performanceId: '', teamId: '', date: '', room: '', start: '', end: '', ...defaults };
  };

  const [performances, setPerformances] = useState([]);
  const [myPending, setMyPending] = useState([]);
  const [teamRoles, setTeamRoles] = useState({}); // teamId -> 'LEADER'|'DEPUTY'|'MEMBER' (내 역할)
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [cards, setCards] = useState([makeCard()]);
  const [results, setResults] = useState(null); // null | [{ card, status: 'fulfilled'|'rejected', value/reason }]
  const [submitting, setSubmitting] = useState(false);

  const loadPending = () => {
    if (myTeams.length === 0) return;
    Promise.all(myTeams.map((t) => api.getTeamSchedules(t.id)))
      .then((pages) => setMyPending(pages.flatMap((p) => p.content ?? []).filter((s) => s.status === 'PENDING')))
      .catch(() => {});
  };

  // 팀장/부팀장만 신청을 생성할 수 있어(백엔드 확인됨), 신청 전에 내 팀 내 역할을 미리 보여준다.
  const loadTeamRoles = () => {
    if (myTeams.length === 0) return;
    Promise.all(myTeams.map((t) => api.getTeam(t.id)))
      .then((teams) => {
        const map = {};
        teams.forEach((team) => {
          const mine = team.members?.find((m) => m.userId === user.id);
          if (mine) map[team.id] = mine.role;
        });
        setTeamRoles(map);
      })
      .catch(() => {});
  };

  useEffect(() => {
    api.getPerformances()
      .then((list) => {
        setPerformances(list);
        const defaultPerf = list[0] ? String(list[0].id) : '';
        const defaultTeam = defaultTeamFor(list, defaultPerf, myTeams);
        setCards((cs) => cs.map((c) => ({
          ...c,
          performanceId: c.performanceId || defaultPerf,
          teamId: c.teamId || defaultTeam,
        })));
      })
      .catch((err) => setLoadError(err.message || '공연 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));

    loadPending();
    loadTeamRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.teamIds?.join(',')]);

  const addCard = () => {
    const last = cards[cards.length - 1];
    setCards((cs) => [...cs, makeCard({ performanceId: last?.performanceId ?? '', teamId: last?.teamId ?? '' })]);
  };
  const removeCard = (uid) => setCards((cs) => (cs.length > 1 ? cs.filter((c) => c.uid !== uid) : cs));
  const updateCard = (uid, next) => setCards((cs) => cs.map((c) => (c.uid === uid ? next : c)));

  const allComplete = cards.every((c) => FIELD_KEYS.every((k) => c[k] !== ''));
  const allValid = cards.every((c) => validate(c).length === 0);
  const canSubmit = allComplete && allValid && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const settled = await Promise.allSettled(cards.map((c) => api.createSchedule({
      performanceId: Number(c.performanceId),
      teamId: Number(c.teamId),
      practiceDate: c.date,
      startTime: toBackendTime(c.start),
      endTime: toBackendTime(c.end),
      alternativeRoom: c.room,
    })));
    setResults(cards.map((c, i) => ({ card: c, outcome: settled[i] })));
    setSubmitting(false);
    loadPending();
  };

  const resetAll = () => {
    const defaultPerf = performances[0] ? String(performances[0].id) : '';
    const defaultTeam = defaultTeamFor(performances, defaultPerf, myTeams);
    uidRef.current += 1;
    setCards([{ uid: uidRef.current, performanceId: defaultPerf, teamId: defaultTeam, date: '', room: '', start: '', end: '' }]);
    setResults(null);
  };

  const cancelPending = async (id) => {
    try {
      await api.cancelSchedule(id);
      loadPending();
    } catch (err) {
      setLoadError(err.message);
    }
  };

  if (loading) {
    return <div className="card">불러오는 중…</div>;
  }

  if (myTeams.length === 0) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="validation-msg validation-err">⚠ 소속된 팀이 없어 일정을 신청할 수 없습니다. 관리자에게 팀 배정을 요청해 주세요.</div>
      </div>
    );
  }

  if (results) {
    const successCount = results.filter((r) => r.outcome.status === 'fulfilled').length;
    return (
      <div style={{ maxWidth: 620 }}>
        <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
          <div className="card-title" style={{ justifyContent: 'center' }}>{successCount}건의 신청이 처리되었습니다</div>
          <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>관리자가 검토 후 연습실을 배정하면 상태가 변경됩니다.</p>
        </div>

        {results.map(({ card, outcome }, i) => (
          <div className={`receipt-card${outcome.status === 'rejected' ? ' failed' : ''}`} key={card.uid}>
            <div className="receipt-card-top">
              <b>신청 {i + 1}</b>
              {outcome.status === 'fulfilled' ? (
                <span className="badge badge-notice">{outcome.value.status}</span>
              ) : (
                <span className="badge badge-urgent">실패</span>
              )}
            </div>
            {outcome.status === 'fulfilled' ? (
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                {outcome.value.performanceName} · {outcome.value.teamName}<br />
                {dateOfAt(outcome.value.startAt)} · {timeOfAt(outcome.value.startAt)}–{timeOfAt(outcome.value.endAt)}
                {isOvernightAt(outcome.value.startAt, outcome.value.endAt) ? ' (익일)' : ''} ·
                {' '}{roomLabels[card.room]}(후보)
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#9C1F27' }}>⚠ {outcome.reason.message}</div>
            )}
          </div>
        ))}

        <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => navigate('/schedule')}>일정 확인하기</button>
          <button className="btn" onClick={resetAll}>새로 신청하기</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ maxWidth: 620 }}>
        {loadError && <div className="validation-msg validation-err" style={{ marginBottom: 14 }}>⚠ {loadError}</div>}

        {cards.map((card, i) => (
          <RequestCard
            key={card.uid}
            index={i}
            card={card}
            performances={performances}
            myTeams={myTeams}
            teamRoles={teamRoles}
            onChange={(next) => updateCard(card.uid, next)}
            onRemove={() => removeCard(card.uid)}
            removable={cards.length > 1}
          />
        ))}

        <button type="button" className="add-card-btn" onClick={addCard}>
          <IconPlus width={14} height={14} /> 일정 추가
        </button>

        <div className="rule-box">
          <div className="rule-box-title">신청 규칙 요약</div>
          <ul className="rule-list">
            <li>팀당 하루 최대 4시간 사용 가능 (외부연습실 포함)</li>
            <li>자정을 넘기는 새벽 연습도 신청 가능 (종료 시각은 자동으로 다음날로 처리됩니다)</li>
            <li>치어룸은 수요일 18:30~20:30 고정 시간에만 신청 가능</li>
            <li>연습실은 신청 시 "후보"만 지정되며, 최종 배정은 관리자가 진행합니다</li>
            <li>신청은 항상 "다음 주" 일정만 가능 (전주 일요일까지 / 그 이후 주는 아직 신청 기간이 아닙니다)</li>
            <li>한 번에 여러 건을 담아 함께 신청할 수 있습니다</li>
          </ul>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button className="btn" onClick={resetAll}>초기화</button>
          <button className="btn btn-primary" disabled={!canSubmit} onClick={handleSubmit}
                  style={!canSubmit ? { flex: 1, opacity: 0.5, cursor: 'not-allowed' } : { flex: 1 }}>
            <IconCheck /> {submitting ? '신청 중…' : `신청 완료 (${cards.length}건)`}
          </button>
        </div>
      </div>

      {myPending.length > 0 && (
        <div className="card" style={{ maxWidth: 620, marginTop: 18 }}>
          <div className="card-header">
            <div className="card-title">우리 팀의 대기중인 신청</div>
          </div>
          {myPending.map((s) => (
            <div className="sched-row" key={s.id}>
              <div>
                <div className="team-name">{s.teamName} · {s.performanceName}</div>
                <div className="team-time">
                  {dateOfAt(s.startAt)} · {timeOfAt(s.startAt)}–{timeOfAt(s.endAt)}{isOvernightAt(s.startAt, s.endAt) ? ' (익일)' : ''}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => cancelPending(s.id)}>취소</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
