// 연습실 종류는 백엔드 enum(AssignRoomRequest.room 등)과 동일한 키를 쓴다.
// 새 연습실 타입을 추가할 땐 이 맵과 Schedule.jsx의 roomColor를 함께 갱신할 것.
export const roomLabels = {
  CLUB_ROOM: '동아리방',
  CHEER_ROOM: '치어룸',
  STUDENT_UNION_BASEMENT: '학생회관 지하',
  EXTERNAL: '외부 연습실',
  UNDERGROUND_PARKING: '지하 주차장',
};

export const roomOrder = ['CLUB_ROOM', 'CHEER_ROOM', 'STUDENT_UNION_BASEMENT', 'EXTERNAL', 'UNDERGROUND_PARKING'];

// 사진 게시판(Photo.jsx) 전용 목업. 백엔드에 대응 API가 없어 항상 이 데이터를 사용한다.
export const mockPhotos = [
  { id: 1, label: '5월 정기공연 · WAVE팀', category: 'performance' },
  { id: 2, label: '5월 정기공연 · BEAT팀', category: 'performance' },
  { id: 3, label: '봄 연습 풍경', category: 'practice' },
  { id: 4, label: '신입 환영 행사', category: 'event' },
  { id: 5, label: '3월 공연 · NOVA팀', category: 'performance' },
];
