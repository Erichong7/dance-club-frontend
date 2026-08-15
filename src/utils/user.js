// UserDetailResponse는 teamIds/teamNames를 같은 순서의 병렬 배열로 내려준다 (한 사용자가 여러 팀에 속할 수 있음).
export function getMyTeams(user) {
  if (!user) return [];
  const ids = user.teamIds ?? [];
  const names = user.teamNames ?? [];
  return ids.map((id, i) => ({ id, name: names[i] ?? `팀 #${id}` }));
}

export function formatMyTeamNames(user) {
  const teams = getMyTeams(user);
  return teams.length ? teams.map((t) => t.name).join(', ') : '소속팀 없음';
}
