const BASE_URL = '/api';

// 401(토큰 만료)을 재발급으로도 못 살리면 호출되는 전역 로그아웃 훅. AuthContext가 등록한다.
let unauthorizedHandler = null;
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

function getAccessToken() {
  return localStorage.getItem('accessToken');
}
function getRefreshToken() {
  return localStorage.getItem('refreshToken');
}
function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
}
export function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

// 액세스 토큰(JWT)의 payload만 디코딩. 서명 검증은 서버가 하므로 여기선 sub(사용자 id) 등
// 화면 표시에 필요한 최소 정보만 읽어온다.
export function decodeAccessToken() {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

async function parseBody(res) {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// 리프레시 토큰으로 accessToken/refreshToken을 재발급. 동시에 여러 요청이 401을 맞아도
// 재발급 호출은 한 번만 나가도록 진행 중인 Promise를 공유한다.
let reissuePromise = null;
function reissue() {
  if (reissuePromise) return reissuePromise;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(false);

  reissuePromise = fetch(`${BASE_URL}/auth/reissue`, {
    method: 'POST',
    headers: { 'Refresh-Token': refreshToken },
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const data = await parseBody(res);
      if (!data?.accessToken) return false;
      setTokens(data);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      reissuePromise = null;
    });

  return reissuePromise;
}

function statusMessage(status, body) {
  if (typeof body === 'string' && body.trim()) return body;
  if (body && typeof body === 'object' && typeof body.message === 'string') return body.message;
  if (status === 400) return '입력값을 다시 확인해 주세요.';
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
  if (status === 403) return '이 작업을 수행할 권한이 없습니다.';
  if (status === 404) return '요청한 정보를 찾을 수 없습니다.';
  return `요청에 실패했습니다. (${status})`;
}

// 백엔드가 { code, message } 형태의 에러 본문을 내려주는 요청(현재는 로그인)에서 코드로 분기하고
// 싶을 때 쓰는 헬퍼. code가 없는 응답(대부분의 다른 엔드포인트)에서는 undefined를 반환한다.
function errorCode(body) {
  return body && typeof body === 'object' && typeof body.code === 'string' ? body.code : undefined;
}

// options.auth === false 인 요청은 로그인 없이도 호출 가능한 엔드포인트(로그인/회원가입/공지 조회 등)로,
// 401을 맞아도 재발급을 시도하거나 전역 로그아웃을 트리거하지 않는다.
async function request(path, options = {}) {
  const { auth = true, ...fetchOptions } = options;

  const build = () => {
    const token = getAccessToken();
    return {
      ...fetchOptions,
      headers: {
        ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...fetchOptions.headers,
      },
    };
  };

  let res = await fetch(`${BASE_URL}${path}`, build());

  if (res.status === 401 && auth && getRefreshToken()) {
    const ok = await reissue();
    if (ok) res = await fetch(`${BASE_URL}${path}`, build());
  }

  const body = await parseBody(res);

  if (!res.ok) {
    // 401만 "세션이 더 이상 유효하지 않다"는 신호로 취급해 전역 로그아웃한다.
    // 403은 특정 리소스에 대한 권한 부족(혹은 아직 없는 엔드포인트)일 뿐, 로그인 자체가
    // 무효화된 것은 아니므로 토큰을 지우지 않는다 — 그렇지 않으면 예: 아직 배포되지 않은
    // GET /api/auth/me 하나만 403을 내도 방금 로그인한 세션 전체가 날아가 버린다.
    if (auth && res.status === 401) {
      clearTokens();
      unauthorizedHandler?.();
    }
    const error = new Error(statusMessage(res.status, body));
    error.code = errorCode(body);
    error.status = res.status;
    throw error;
  }
  return body;
}

function qs(params) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
}

export const api = {
  // ---------- Auth (로그인 불필요) ----------
  // 로그인 실패는 이제 백엔드가 { code, message } 본문으로 사유를 구분해 내려준다:
  //   INVALID_CREDENTIALS(401) / SIGNUP_PENDING(403) / SIGNUP_REJECTED(403).
  // request()가 err.code에 그대로 실어주므로 여기선 그대로 전파하고, 응답 자체가 없는(네트워크 오류 등)
  // 경우에만 대체 문구를 붙인다.
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }), auth: false })
      .catch((err) => {
        if (!err.code) err.message = err.message || '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.';
        throw err;
      }),
  signup: (email, password, passwordConfirm, nickname, phoneNumber) =>
    request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, passwordConfirm, nickname, phoneNumber }),
      auth: false,
    })
      .catch((err) => {
        err.message = err.message || '입력값을 확인해 주세요. (이메일 형식, 8자 이상 비밀번호, 휴대폰 번호 형식 등)';
        throw err;
      }),

  // ---------- Auth (로그인 필요, 관리자) ----------
  // 회원가입 요청 목록은 검색(닉네임/이메일/상태)까지 지원하는 회원 검색 API로 대체 조회한다
  // (searchUsers 참고) — 아래 getSignupRequests는 상태 필터 없이 REQUESTED/REJECTED 전체를 볼 때 쓴다.
  getSignupRequests: (page = 0, size = 10) => request(`/auth/signup-requests${qs({ page, size })}`),
  approveSignup: (requestedId) => request(`/auth/${requestedId}/approve`, { method: 'PATCH' }),
  rejectSignup: (requestedId) => request(`/auth/${requestedId}/reject`, { method: 'PATCH' }),

  // ---------- Auth (로그인 필요) ----------
  logout: () => request('/auth/logout', { method: 'POST' }),

  // 로그인한 사용자의 프로필. UserDetailResponse 응답 형태:
  // { id, email, nickName, role: 'USER'|'ADMIN', teamIds: number[], teamNames: string[] }
  // 한 사용자가 여러 팀에 속할 수 있어 teamId 단수가 아니라 배열로 내려온다.
  getMe: () => request('/users/me'),

  // 닉네임/이메일 키워드 + 가입상태(REQUESTED/APPROVED/REJECTED)로 회원 검색. 관리자 전용.
  // UserSearchRequest, Pageable이 둘 다 평평한 쿼리 파라미터로 매핑된다(백엔드 @ModelAttribute).
  // UserSearchResponse: { id, email, nickName, phoneNumber, role, signupStatus, createdAt }
  searchUsers: ({ nickname, email, signupStatus } = {}, { page = 0, size = 10 } = {}) =>
    request(`/users/search${qs({ nickname, email, signupStatus, page, size })}`),
  // 회원 삭제. 관리자 전용, 본인 계정은 삭제 불가(백엔드가 SELF_DELETE_FORBIDDEN으로 거부).
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  // ---------- Team (로그인 필요) ----------
  getTeams: () => request('/teams'),
  getTeam: (id) => request(`/teams/${id}`),
  // performanceId를 넘기면 해당 공연 하위 팀으로 바로 등록된다(TeamCreateRequest.performanceId, 선택값).
  createTeam: (name, performanceId) =>
    request('/teams', {
      method: 'POST',
      body: JSON.stringify({ name, ...(performanceId ? { performanceId: Number(performanceId) } : {}) }),
    }),
  addTeamMember: (teamId, userId, role) =>
    request(`/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify({ userId, role }) }),
  updateTeamMemberRole: (teamId, targetUserId, role) =>
    request(`/teams/${teamId}/members/${targetUserId}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  removeTeamMember: (teamId, targetUserId) =>
    request(`/teams/${teamId}/members/${targetUserId}`, { method: 'DELETE' }),
  deleteTeam: (id) => request(`/teams/${id}`, { method: 'DELETE' }),

  // ---------- Performance (로그인 필요) ----------
  getPerformances: () => request('/performances'),
  getPerformance: (id) => request(`/performances/${id}`),
  createPerformance: (payload) => request('/performances', { method: 'POST', body: JSON.stringify(payload) }),
  deletePerformance: (id) => request(`/performances/${id}`, { method: 'DELETE' }),

  // ---------- Schedule (로그인 필요) ----------
  getWeekSchedules: (performanceId, weekStart, page = 0, size = 100) =>
    request(`/schedules${qs({ performanceId, weekStart, page, size })}`),
  getTeamSchedules: (teamId, page = 0, size = 100) => request(`/schedules/team/${teamId}${qs({ page, size })}`),
  getTeamWeekSchedules: (teamId, performanceId, weekStart, page = 0, size = 100) =>
    request(`/schedules/team/${teamId}/week${qs({ performanceId, weekStart, page, size })}`),
  getSchedule: (id) => request(`/schedules/${id}`),
  createSchedule: (payload) => request('/schedules', { method: 'POST', body: JSON.stringify(payload) }),
  cancelSchedule: (id) => request(`/schedules/${id}/cancel`, { method: 'POST' }),
  deleteSchedule: (id) => request(`/schedules/${id}`, { method: 'DELETE' }),
  rejectSchedule: (id, adminNote) =>
    request(`/schedules/${id}/reject`, { method: 'POST', body: JSON.stringify({ adminNote }) }),
  assignWeek: (performanceId, weekStart) =>
    request(`/schedules/assign${qs({ performanceId, weekStart })}`, { method: 'POST' }),
  assignManual: (payload) => request('/schedules/assign/manual', { method: 'POST', body: JSON.stringify(payload) }),
  reassignRoom: (id, room) => request(`/schedules/${id}/room`, { method: 'PUT', body: JSON.stringify({ room }) }),

  // ---------- Post = 게시글/공지사항 (목록·상세 조회는 로그인 불필요) ----------
  getPosts: (page = 0, size = 20) => request(`/posts${qs({ page, size })}`, { auth: false }),
  getPost: (id) => request(`/posts/${id}`, { auth: false }),
  createPost: (title, content) => request('/posts', { method: 'POST', body: JSON.stringify({ title, content }) }),
  updatePost: (id, title, content) =>
    request(`/posts/${id}`, { method: 'PUT', body: JSON.stringify({ title, content }) }),
  deletePost: (id) => request(`/posts/${id}`, { method: 'DELETE' }),
};

// 백엔드 미연결 상태에서 프론트만 확인할 때 쓰는 목업 스위치. 사진 게시판(Photo.jsx)은
// 백엔드에 대응 API가 없어 이 값과 무관하게 항상 목업 데이터를 사용한다.
export const USE_MOCK = false;
