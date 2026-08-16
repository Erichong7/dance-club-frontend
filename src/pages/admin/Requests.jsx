import { useEffect, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '../../components/Icons.jsx';
import { api } from '../../api/client.js';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { roomLabels, roomOrder } from '../../api/mockData.js';
import { mondayOf, addDays, toISODate, formatWeekRange, toBackendTime, dateOfAt, timeOfAt, isOvernightAt } from '../../utils/date.js';

const STATUS_LABEL = { PENDING: '대기중', APPROVED: '배정됨', REJECTED: '반려됨', CANCELLED: '취소됨' };
const STATUS_BADGE = { PENDING: 'badge-notice', APPROVED: 'badge-info', REJECTED: 'badge-urgent', CANCELLED: 'badge-gray' };
const TABS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

const manualInitial = { teamId: '', date: '', room: '', start: '', end: '' };

export default function AdminRequests() {
  const [performances, setPerformances] = useState([]);
  const [performanceId, setPerformanceId] = useState('');
  const [teams, setTeams] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [schedules, setSchedules] = useState([]);
  const [tab, setTab] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [reassigningId, setReassigningId] = useState(null);
  const [reassignRoom, setReassignRoom] = useState('');
  const [assigningWeek, setAssigningWeek] = useState(false);
  const [manualForm, setManualForm] = useState(manualInitial);
  const [manualSaving, setManualSaving] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const monday = addDays(mondayOf(new Date()), weekOffset * 7);

  useEffect(() => {
    Promise.allSettled([api.getPerformances(), api.getTeams()]).then(([perfR, teamR]) => {
      if (perfR.status === 'fulfilled') {
        setPerformances(perfR.value);
        if (perfR.value[0]) setPerformanceId(String(perfR.value[0].id));
      } else {
        setError(perfR.reason?.message);
      }
      if (teamR.status === 'fulfilled') setTeams(teamR.value);
    });
  }, []);

  const load = () => {
    if (!performanceId) return;
    setLoading(true);
    setError('');
    api.getWeekSchedules(performanceId, toISODate(monday))
      .then((page) => setSchedules(page.content ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [performanceId, monday.getTime()]);

  const filtered = tab === 'ALL' ? schedules : schedules.filter((s) => s.status === tab);
  const counts = TABS.reduce((acc, t) => {
    acc[t] = t === 'ALL' ? schedules.length : schedules.filter((s) => s.status === t).length;
    return acc;
  }, {});

  const runAssignWeek = async () => {
    setAssigningWeek(true);
    setError('');
    try {
      await api.assignWeek(performanceId, toISODate(monday));
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAssigningWeek(false);
    }
  };

  const submitReject = async (id) => {
    setBusyId(id);
    setError('');
    try {
      await api.rejectSchedule(id, rejectNote);
      setRejectingId(null);
      setRejectNote('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const submitReassign = async (id) => {
    if (!reassignRoom) return;
    setBusyId(id);
    setError('');
    try {
      await api.reassignRoom(id, reassignRoom);
      setReassigningId(null);
      setReassignRoom('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemoveSchedule = async () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    setBusyId(id);
    setError('');
    try {
      await api.deleteSchedule(id);
      setDeleteTargetId(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const submitManual = async () => {
    const { teamId, date, room, start, end } = manualForm;
    if (!teamId || !date || !room || !start || !end) return;
    setManualSaving(true);
    setError('');
    try {
      await api.assignManual({
        performanceId: Number(performanceId),
        teamId: Number(teamId),
        practiceDate: date,
        startTime: toBackendTime(start),
        endTime: toBackendTime(end),
        room,
      });
      setManualForm(manualInitial);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setManualSaving(false);
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="week-header">
          <div className="form-group" style={{ minWidth: 220 }}>
            <select className="form-select" value={performanceId} onChange={(e) => setPerformanceId(e.target.value)}>
              {performances.length === 0 && <option value="">등록된 공연이 없습니다</option>}
              {performances.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="week-nav">
            <button onClick={() => setWeekOffset((w) => w - 1)} aria-label="이전 주"><IconChevronLeft /></button>
            <div className="week-title">{formatWeekRange(monday)}</div>
            <button onClick={() => setWeekOffset((w) => w + 1)} aria-label="다음 주"><IconChevronRight /></button>
          </div>
          <button className="btn btn-primary btn-sm" disabled={assigningWeek || counts.PENDING === 0} onClick={runAssignWeek}>
            {assigningWeek ? '배정 중…' : `이번 주 일괄 배정 (${counts.PENDING})`}
          </button>
        </div>

        <div className="chip-row" style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {TABS.map((t) => (
            <button
              key={t}
              className={`filter-chip${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'ALL' ? '전체' : STATUS_LABEL[t]} {counts[t]}
            </button>
          ))}
        </div>

        {error && <div className="validation-msg validation-err">⚠ {error}</div>}
        {loading && <p style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>불러오는 중…</p>}
        {!loading && filtered.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>해당하는 신청이 없습니다.</p>}

        {filtered.map((s) => (
          <div key={s.id} style={{ borderBottom: '1px solid var(--color-border)', padding: '12px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="team-name">
                  {s.teamName} · {s.performanceName}
                  <span className={`badge ${STATUS_BADGE[s.status]}`} style={{ marginLeft: 8 }}>{STATUS_LABEL[s.status]}</span>
                </div>
                <div className="team-time">
                  {dateOfAt(s.startAt)} · {timeOfAt(s.startAt)}–{timeOfAt(s.endAt)}{isOvernightAt(s.startAt, s.endAt) ? ' (익일)' : ''}
                  {s.assignedRoom ? ` · ${roomLabels[s.assignedRoom]}` : ' · 연습실 미배정'}
                </div>
                {s.adminNote && <div className="notice-body">메모: {s.adminNote}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {s.status === 'PENDING' && (
                  <button className="btn btn-ghost btn-sm" disabled={busyId === s.id} onClick={() => { setRejectingId(s.id); setRejectNote(''); }}>
                    반려
                  </button>
                )}
                {s.assignedRoom && (
                  <button className="btn btn-ghost btn-sm" disabled={busyId === s.id} onClick={() => { setReassigningId(s.id); setReassignRoom(s.assignedRoom); }}>
                    연습실 변경
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" disabled={busyId === s.id} onClick={() => setDeleteTargetId(s.id)}>삭제</button>
              </div>
            </div>

            {rejectingId === s.id && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input className="form-input" placeholder="반려 사유 (선택)" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
                <button className="btn btn-primary btn-sm" disabled={busyId === s.id} onClick={() => submitReject(s.id)}>반려 확정</button>
                <button className="btn btn-sm" onClick={() => setRejectingId(null)}>취소</button>
              </div>
            )}

            {reassigningId === s.id && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <select className="form-select" style={{ width: 160 }} value={reassignRoom} onChange={(e) => setReassignRoom(e.target.value)}>
                  {roomOrder.map((key) => <option key={key} value={key}>{roomLabels[key]}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" disabled={busyId === s.id} onClick={() => submitReassign(s.id)}>변경 확정</button>
                <button className="btn btn-sm" onClick={() => setReassigningId(null)}>취소</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteTargetId}
        title="일정 삭제"
        message="이 연습 일정을 정말 삭제하시겠습니까? 되돌릴 수 없습니다."
        loading={busyId === deleteTargetId}
        error={error}
        onConfirm={confirmRemoveSchedule}
        onCancel={() => { if (busyId !== deleteTargetId) setDeleteTargetId(null); }}
      />

      <div className="card" style={{ maxWidth: 620 }}>
        <div className="card-header"><div className="card-title">관리자 직접 배정</div></div>
        <p style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)', marginBottom: 12 }}>
          신청 접수 없이, 위에서 선택한 공연으로 팀 일정을 바로 등록하고 연습실까지 배정합니다.
        </p>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">팀</label>
            <select className="form-select" value={manualForm.teamId} onChange={(e) => setManualForm((f) => ({ ...f, teamId: e.target.value }))}>
              <option value="">선택하세요</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">날짜</label>
            <input className="form-input" type="date" value={manualForm.date} onChange={(e) => setManualForm((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">연습실</label>
            <select className="form-select" value={manualForm.room} onChange={(e) => setManualForm((f) => ({ ...f, room: e.target.value }))}>
              <option value="">선택하세요</option>
              {roomOrder.map((key) => <option key={key} value={key}>{roomLabels[key]}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">시작 시간</label>
            <input className="form-input" type="time" value={manualForm.start} onChange={(e) => setManualForm((f) => ({ ...f, start: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">종료 시간</label>
            <input className="form-input" type="time" value={manualForm.end} onChange={(e) => setManualForm((f) => ({ ...f, end: e.target.value }))} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" disabled={manualSaving} onClick={submitManual}>
            {manualSaving ? '등록 중…' : '등록 및 배정'}
          </button>
        </div>
      </div>
    </div>
  );
}
