import { useEffect, useRef, useState } from 'react';

// 시작 시간 선택지는 08:00~익일 01:30(30분 단위)로 고정한다. END_HOUR를 24 이상으로 두면
// buildStartOptions()가 만드는 분(minute) 값이 1440을 넘어가고, minutesToTime()이 이를
// 자정 기준으로 감싸(mod 1440) 00:00~01:30 같은 익일 새벽 옵션을 자동으로 만들어준다.
// 소요 시간은 이제 자정을 넘겨도 되므로(백엔드가 endTime < startTime을 익일 종료로 해석)
// 영업 종료 시각과 무관하게 항상 최대 4시간까지만 노출한다.
const START_HOUR = 8;
const END_HOUR = 26; // 익일 02:00(배타적 상한) → 마지막 시작 옵션은 01:30
const STEP_MIN = 30;
const MAX_DURATION_MIN = 240; // 소요 시간은 최대 4시간까지만 노출

function pad(n) {
  return String(n).padStart(2, '0');
}

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// 자정을 넘긴 값(예: 1470분)은 24시간 안으로 감싸서 "HH:mm"으로 되돌린다.
function minutesToTime(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

function formatDuration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function buildStartOptions() {
  const opts = [];
  for (let m = START_HOUR * 60; m < END_HOUR * 60; m += STEP_MIN) opts.push(minutesToTime(m));
  return opts;
}

function buildDurationOptions() {
  const opts = [];
  for (let d = STEP_MIN; d <= MAX_DURATION_MIN; d += STEP_MIN) opts.push(d);
  return opts;
}

// end가 start보다 이르거나 같으면(자정을 넘긴 경우) +24시간으로 보정한 소요 시간(분).
// 백엔드(ScheduleService.toOvernightAwareRange)와 동일한 익일 판정 규칙.
function durationMinutes(start, end) {
  const raw = timeToMinutes(end) - timeToMinutes(start);
  return raw > 0 ? raw : raw + 1440;
}

const START_OPTIONS = buildStartOptions();
const DURATION_OPTIONS = buildDurationOptions();

// 시작 시간 → 소요 시간 두 단계로 나눠 고르는 버튼+팝오버 시간 선택기. 네이티브
// <input type="time"> 두 개를 대체해 30분 단위로 탭만으로 신청 시간을 완성할 수 있게 한다.
// start/end는 그대로 "HH:mm" 문자열로 주고받아 validate()/toBackendTime()과 호환된다.
// 소요 시간이 4시간을 넘지 않는 한 자정을 넘기는 종료 시각(예: 22:30 시작 + 2시간 = 00:30)도 만들 수 있다.
export default function TimeRangePicker({ start, end, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const currentDuration = start && end ? durationMinutes(start, end) : null;
  const overnight = start && end && timeToMinutes(end) <= timeToMinutes(start);

  const pickStart = (value) => {
    // 자정 넘김이 섞이면 "기존 종료 시각이 여전히 유효한지" 판단이 애매해지므로,
    // 시작 시각을 바꾸면 항상 종료 시각을 다시 고르게 한다.
    onChange({ start: value, end: '' });
  };

  const pickDuration = (mins) => {
    onChange({ start, end: minutesToTime(timeToMinutes(start) + mins) });
    setOpen(false);
  };

  const label = start && end
    ? `${start} – ${end}${overnight ? ' (익일)' : ''} · ${formatDuration(currentDuration)}`
    : '연습 시간을 선택하세요';

  return (
    <div className="room-picker" ref={wrapRef}>
      <button
        type="button"
        className="form-input room-picker-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        <span className="room-picker-caret">▾</span>
      </button>

      {open && (
        <div className="room-picker-panel" style={{ minWidth: 320 }}>
          <div className="room-picker-hint" style={{ marginLeft: 0, marginBottom: 4 }}>시작 시간</div>
          <div className="time-chip-scroll">
            {START_OPTIONS.map((t) => (
              <button
                type="button"
                key={t}
                className={`room-tag${start === t ? ' room-tag-active' : ''}`}
                onClick={() => pickStart(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="room-picker-hint" style={{ marginLeft: 0, marginTop: 10, marginBottom: 4 }}>소요 시간</div>
          <div className="time-chip-scroll">
            {!start && <span className="time-chip-empty">시작 시간을 먼저 선택하세요</span>}
            {start && DURATION_OPTIONS.map((mins) => (
              <button
                type="button"
                key={mins}
                className={`room-tag${currentDuration === mins ? ' room-tag-active' : ''}`}
                onClick={() => pickDuration(mins)}
              >
                {formatDuration(mins)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
