# 댄스 동아리 연습 스케줄러 - 프론트엔드

React + Vite로 만든 프론트엔드입니다. `localhost:8080`에서 실행 중인 Spring Boot 백엔드와 실제로 연동됩니다
(`src/api/mockData.js`의 목업은 백엔드 API가 아예 없는 사진 게시판에서만 사용합니다).

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속. Spring Boot 백엔드가 8080 포트에 떠 있어야 로그인/일정/공지 등 대부분의
화면이 정상 동작합니다 (`vite.config.js`에 `/api` 프록시가 설정되어 있음). 백엔드 Swagger 문서는
http://localhost:8080/swagger-ui/index.html 에서 확인할 수 있습니다.

## 인증

- `POST /api/auth/login` (이메일+비밀번호) → `{ accessToken, refreshToken }`을 `localStorage`에 저장
- 이후 모든 요청에 `Authorization: Bearer <accessToken>` 자동 첨부
- 액세스 토큰 만료(401) 시 `POST /api/auth/reissue`로 자동 재발급 후 원래 요청 재시도
- 로그인 없이 접근 가능한 화면/API: `/login`, `/signup`, 공지사항 목록·상세(`GET /api/posts`, `GET /api/posts/{id}`)
  그 외(일정 조회/신청, 팀·공연 관리, 공지 작성 등)는 전부 로그인이 필요합니다.

### 로그인한 사용자 정보: `GET /api/auth/me`

로그인한 사용자의 프로필은 `GET /api/auth/me` (`UserDetailResponse`)에서 가져옵니다:
`{ id, email, nickName, role: 'ADMIN'|'USER', teamIds: number[], teamNames: string[] }`.
한 사용자가 여러 팀에 속할 수 있어 `teamId` 단수가 아니라 배열로 내려오며, 화면에서는
`src/utils/user.js`의 `getMyTeams(user)` / `formatMyTeamNames(user)`를 통해서만 접근합니다.

이 API 호출이 실패하면(네트워크 오류 등) `src/context/AuthContext.jsx`가 JWT의 `sub` 클레임만으로
최소 프로필을 구성해 화면이 깨지지 않게 폴백합니다 (`role: 'USER'`로 간주하므로 이 경우 관리자 메뉴는
보이지 않습니다). 폴백조차 불가능한 완전히 깨진 토큰이 `localStorage`에 남아있으면 세션을 정리하고
로그인 화면으로 돌려보냅니다.

## 폴더 구조

```
src/
  api/          # 백엔드 통신 (client.js) + 목업 데이터 (mockData.js, 사진 게시판 전용)
  context/      # AuthContext (로그인 상태, 사용자 프로필, 관리자 여부)
  components/   # Sidebar, Topbar, ProfileMenu, 아이콘
  pages/        # Dashboard, Schedule, Apply, Notice, Photo, Login, Signup
  pages/admin/  # 관리자 전용: Teams, Performances, Requests
  utils/        # date.js (주간 계산, 시간 포맷 등)
  styles/       # 디자인 토큰(tokens.css) + 컴포넌트 스타일(app.css)
```

## 핵심 기능

- **일정 신청 (Apply.jsx)**: 입력값이 바뀔 때마다 동아리 규칙(2시간 제한, 치어룸 수요일 고정시간,
  전주 일요일 마감 등)을 자동으로 검증합니다. 신청은 "후보 연습실"만 지정하며, 최종 배정은 관리자가 진행합니다.
- **주간 캘린더 (Schedule.jsx)**: 공연을 선택하고 주 단위로 이동하며, 연습실 종류별 색상 구분과
  배정 대기(PENDING) 상태를 함께 보여줍니다.
- **관리자 신청 검토·배정 (admin/Requests.jsx)**: 상태별 탭 필터, 주간 일괄 자동배정, 개별 반려,
  연습실 재배정, 관리자 직접 등록(신청 없이 바로 일정+연습실 등록)을 지원합니다. 백엔드에 "개별 승인" API가
  없어 승인은 항상 주간 일괄배정으로만 이루어집니다.
- **팀/공연 관리 (admin/Teams.jsx, admin/Performances.jsx)**: 팀 생성, 팀원 추가/역할변경/제거,
  공연 등록/삭제. 회원 검색 API가 없어 팀원 추가 시 사용자 ID를 직접 입력해야 합니다.
- **사진 게시판 (Photo.jsx)**: 백엔드 API가 없어 목업 데이터로만 동작하는 프로토타입 화면입니다.

## 참고사항

이 저장소의 `src/pages/admin/*`은 백엔드가 실제로 지원하는 엔드포인트에 맞춰 설계되었습니다 — 예를 들어
"신청 1건 승인" 버튼이 없는 건 실수가 아니라, 그런 API가 없고 승인은 주간 일괄배정으로만 가능하기 때문입니다.
새 화면을 추가하기 전에 `http://localhost:8080/v3/api-docs`로 실제 스펙을 다시 확인하세요 (Swagger의
`security` 표기가 실제 런타임 인가 여부와 다를 수 있으니, 의심되면 `curl`로 직접 검증하는 걸 추천합니다).
