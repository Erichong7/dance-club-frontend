import { useEffect, useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconClipboard } from '../components/Icons.jsx';
import { api } from '../api/client.js';
import { roomLabels, roomOrder } from '../api/mockData.js';
import {
  mondayOf, addDays, toISODate, formatWeekRange, timeStringToHour, dayIndexFromMonday,
  dateOfAt, timeOfAt, isOvernightAt, DAY_LABELS,
} from '../utils/date.js';

const DEFAULT_ROW_START = 12; // 기본 그리드는 12:00부터
const GRID_END = 24; // 그리드 끝은 항상 24:00 고정(자정 넘긴 종료는 여기서 클리핑해서 그림)

const roomColor = {
  CLUB_ROOM: { border: 'var(--color-stage)', bg: 'var(--color-stage-tint)', text: 'var(--color-stage-dark)' },
  CHEER_ROOM: { border: 'var(--color-mint)', bg: 'var(--color-mint-tint)', text: '#0B6E56' },
  STUDENT_UNION_BASEMENT: { border: 'var(--color-yellow)', bg: 'var(--color-yellow-tint)', text: 'var(--color-yellow-dark)' },
  EXTERNAL: { border: 'var(--color-amber)', bg: 'var(--color-amber-tint)', text: '#8A5300' },
  UNDERGROUND_PARKING: { border: 'var(--color-text-tertiary)', bg: 'var(--color-surface-sunken)', text: 'var(--color-text-secondary)' },
};

// 같은 요일 안에서 시간이 겹치는 이벤트들을 찾아 나란히 배치할 열(column)을 계산
function layoutDayEvents(dayEvents) {
  const sorted = [...dayEvents].sort((a, b) => a.start - b.start || a.end - b.end);
  const layout = new Map();
  let cluster = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    const colEnds = [];
    const colOf = new Map();
    for (const ev of cluster) {
      let col = colEnds.findIndex((end) => end <= ev.start);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(ev.end);
      } else {
        colEnds[col] = ev.end;
      }
      colOf.set(ev.id, col);
    }
    const cols = colEnds.length;
    for (const ev of cluster) layout.set(ev.id, { col: colOf.get(ev.id), cols });
    cluster = [];
  };

  for (const ev of sorted) {
    if (cluster.length && ev.start >= clusterEnd) flushCluster();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.end);
  }
  if (cluster.length) flushCluster();

  return layout;
}

// 시간(예: 18.5) -> "18:30"
function formatHour(h) {
  const hh = Math.floor(h);
  const mm = h % 1 === 0 ? '00' : '30';
  return `${String(hh).padStart(2, '0')}:${mm}`;
}

// 현재 화면에 보이는 주간 일정을 날짜별로 묶어 텍스트로 직렬화 (클립보드 복사용).
// 같은 날짜는 헤더에서 한 번만 표기하고, 날짜가 바뀔 때만 빈 줄로 구분한다.
function buildCopyText(events, monday, performanceName, teamName) {
  const sunday = addDays(monday, 6);
  const range = `${monday.getMonth() + 1}/${monday.getDate()}~${sunday.getMonth() + 1}/${sunday.getDate()}`;
  const titleParts = [performanceName, teamName, `${range} 연습 일정`].filter(Boolean);
  const sorted = [...events].sort((a, b) => a.day - b.day || a.start - b.start);

  const lines = [`[${titleParts.join(' · ')}]`, ''];
  let lastDay = null;
  for (const e of sorted) {
    const endText = e.overnight ? `익일 ${e.endLabel}` : formatHour(e.end);
    const timeLine = `${formatHour(e.start)}-${endText} ${e.team} @${roomLabels[e.room] ?? e.room}`;
    if (e.day !== lastDay) {
      if (lastDay !== null) lines.push('');
      const d = addDays(monday, e.day);
      const dateLabel = `${d.getMonth() + 1}/${d.getDate()}(${DAY_LABELS[e.day]})`;
      lines.push(dateLabel, timeLine);
      lastDay = e.day;
    } else {
      lines.push(timeLine);
    }
  }
  return lines.join('\n');
}

function EventBlock({ ev, col, cols, rowStart }) {
  const c = roomColor[ev.room];
  const top = (ev.start - rowStart) * 48;
  const height = Math.max((ev.end - ev.start) * 48 - 2, 20);
  const widthPct = 100 / cols;
  const endText = ev.overnight ? `익일 ${ev.endLabel}` : formatHour(ev.end);
  return (
    <div
      className={`event-block${ev.overnight ? ' event-block-overnight' : ''}`}
      style={{
        top,
        height,
        left: `calc(${col * widthPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        right: 'auto',
        background: c.bg,
        color: c.text,
        borderLeftColor: c.border,
      }}
      title={`${ev.team} · ${ev.status} ${formatHour(ev.start)}-${endText}`}
    >
      <div>{ev.team}</div>
      <div className="ev-time">{formatHour(ev.start)}–{endText}</div>
    </div>
  );
}

export default function Schedule() {
  const [performances, setPerformances] = useState([]);
  const [performanceId, setPerformanceId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copyState, setCopyState] = useState(''); // '' | 'copied' | 'failed'

  const monday = addDays(mondayOf(new Date()), weekOffset * 7);
  const availableTeams = performances.find((p) => String(p.id) === String(performanceId))?.teams ?? [];

  const handleCopy = async () => {
    const performanceName = performances.find((p) => String(p.id) === String(performanceId))?.name ?? '';
    const text = buildCopyText(displayedEvents, monday, performanceName, selectedTeamName ?? '');
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState(''), 1500);
  };

  useEffect(() => {
    api.getPerformances().then((list) => {
      setPerformances(list);
      if (list.length > 0) setPerformanceId(String(list[0].id));
    }).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!performanceId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    // 로그인 없이도 팀 필터가 동작하도록, 인증이 필요한 /schedules/team/{id}/week 대신
    // 공개 엔드포인트(/schedules)로 주간 전체 일정을 받아 팀은 프론트에서 걸러낸다.
    api.getWeekSchedules(performanceId, toISODate(monday))
      .then((page) => {
        if (cancelled) return;
        const mapped = (page.content ?? [])
          .filter((s) => s.status === 'APPROVED')
          .map((s) => {
            const overnight = isOvernightAt(s.startAt, s.endAt);
            return {
              id: s.id,
              day: dayIndexFromMonday(dateOfAt(s.startAt), monday),
              start: timeStringToHour(timeOfAt(s.startAt)),
              end: overnight ? 24 : timeStringToHour(timeOfAt(s.endAt)), // 그리드 하단(24:00)까지만 그림
              overnight,
              endLabel: timeOfAt(s.endAt), // 실제 종료 시각(라벨/툴팁용)
              team: s.teamName,
              room: s.assignedRoom,
              status: s.status,
            };
          })
          .filter((e) => e.day >= 0 && e.day <= 6);
        setEvents(mapped);
      })
      .catch((err) => setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [performanceId, monday.getTime()]);

  const selectedTeamName = teamId ? availableTeams.find((t) => String(t.id) === String(teamId))?.name : '';
  const displayedEvents = selectedTeamName ? events.filter((e) => e.team === selectedTeamName) : events;

  // 기본은 12:00~24:00만 보여주되, 그 주에 12시 이전 시작 연습이 있으면 그만큼만 앞당겨 확장한다.
  const rowStart = Math.min(DEFAULT_ROW_START, ...displayedEvents.map((e) => Math.floor(e.start)));
  const hours = Array.from({ length: GRID_END - rowStart }, (_, i) => `${String(rowStart + i).padStart(2, '0')}:00`);

  return (
    <div>
      <div className="week-header">
        <div className="week-filters">
          <div className="form-group" style={{ minWidth: 220 }}>
            <select
              className="form-select"
              value={performanceId}
              onChange={(e) => { setPerformanceId(e.target.value); setTeamId(''); }}
            >
              {performances.length === 0 && <option value="">등록된 공연이 없습니다</option>}
              {performances.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: 160 }}>
            <select className="form-select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">전체 팀</option>
              {availableTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="week-nav">
          <button onClick={() => setWeekOffset((w) => w - 1)} aria-label="이전 주">
            <IconChevronLeft />
          </button>
          <div className="week-title">{formatWeekRange(monday)}</div>
          <button onClick={() => setWeekOffset((w) => w + 1)} aria-label="다음 주">
            <IconChevronRight />
          </button>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleCopy} disabled={displayedEvents.length === 0}>
          <IconClipboard width={14} height={14} />
          {copyState === 'copied' ? '복사됨' : copyState === 'failed' ? '복사 실패' : '복사'}
        </button>
        <div className="legend">
          {roomOrder.map((key) => (
            <span key={key}><span className="legend-dot" style={{ background: roomColor[key].border }} />{roomLabels[key]}</span>
          ))}
        </div>
      </div>

      {error && <div className="validation-msg validation-err" style={{ marginBottom: 12 }}>⚠ {error}</div>}

      <div className="cal-wrap">
        <div className="cal-head">
          <div className="cal-head-cell" style={{ background: 'var(--color-surface-sunken)' }} />
          {DAY_LABELS.map((label, i) => {
            const d = addDays(monday, i);
            const isToday = toISODate(d) === toISODate(new Date());
            return (
              <div className={`cal-head-cell${isToday ? ' today' : ''}`} key={label}>
                {label}
                <span className="dom">{d.getDate()}</span>
              </div>
            );
          })}
        </div>

        <div className="cal-body">
          <div>
            {hours.map((h) => (
              <div className="time-col-cell" key={h}>{h}</div>
            ))}
          </div>
          {DAY_LABELS.map((_, dayIdx) => {
            const dayEvents = displayedEvents.filter((e) => e.day === dayIdx);
            const layout = layoutDayEvents(dayEvents);
            return (
              <div className="day-col" key={dayIdx}>
                {hours.map((h) => <div className="time-cell" key={h} />)}
                {dayEvents.map((e) => {
                  const { col, cols } = layout.get(e.id);
                  return <EventBlock ev={e} col={col} cols={cols} rowStart={rowStart} key={e.id} />;
                })}
              </div>
            );
          })}
        </div>
      </div>
      {loading && <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 8 }}>불러오는 중…</p>}
    </div>
  );
}
