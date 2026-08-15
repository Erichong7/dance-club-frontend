export const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

function pad(n) {
  return String(n).padStart(2, '0');
}

export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// 주어진 날짜가 속한 주의 월요일(00:00)을 반환.
export function mondayOf(date) {
  const d = new Date(date);
  const dow = d.getDay(); // 0=일 ... 6=토
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatWeekRange(monday) {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const start = `${monday.getMonth() + 1}월 ${monday.getDate()}일`;
  const end = sameMonth ? `${sunday.getDate()}일` : `${sunday.getMonth() + 1}월 ${sunday.getDate()}일`;
  return `${monday.getFullYear()}년 ${start} – ${end}`;
}

// "18:30:00" | "18:30" -> 18.5
export function timeStringToHour(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h + (m || 0) / 60;
}

// "HH:mm" -> "HH:mm:ss" (백엔드 요청 바디용)
export function toBackendTime(hhmm) {
  return hhmm && hhmm.length === 5 ? `${hhmm}:00` : hhmm;
}

// practiceDate("YYYY-MM-DD")가 monday 기준 몇 번째 요일(0=월 ... 6=일)인지.
export function dayIndexFromMonday(practiceDate, monday) {
  const d = new Date(`${practiceDate}T00:00:00`);
  const diffMs = d.setHours(0, 0, 0, 0) - monday.getTime();
  return Math.round(diffMs / 86400000);
}

// ScheduleResponse의 startAt/endAt("2026-07-21T20:37:00", 타임존 없는 LocalDateTime 문자열)에서
// 날짜/시각만 뽑아 쓴다. 서버가 자정 넘긴 종료 시각도 실제 날짜 그대로 내려주므로 문자열 슬라이스면 충분.
export function dateOfAt(iso) {
  return iso ? iso.slice(0, 10) : iso;
}

export function timeOfAt(iso) {
  return iso ? iso.slice(11, 16) : iso;
}

// startAt과 endAt의 날짜 부분이 다르면 자정을 넘긴 일정
export function isOvernightAt(startAtIso, endAtIso) {
  return !!startAtIso && !!endAtIso && dateOfAt(startAtIso) !== dateOfAt(endAtIso);
}
