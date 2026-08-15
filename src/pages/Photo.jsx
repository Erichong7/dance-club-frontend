import { useState } from 'react';
import { mockPhotos } from '../api/mockData.js';

const categories = [
  { key: 'all', label: '전체' },
  { key: 'performance', label: '공연' },
  { key: 'practice', label: '연습' },
  { key: 'event', label: '행사' },
];

export default function Photo() {
  const [active, setActive] = useState('all');
  const filtered = active === 'all' ? mockPhotos : mockPhotos.filter((p) => p.category === active);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">사진 게시판 <span className="badge badge-info" style={{ marginLeft: 8 }}>프로토타입</span></div>
        <button className="btn btn-primary btn-sm">사진 업로드</button>
      </div>

      <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 14 }}>
        ⚠ 백엔드에 사진 게시판 API가 아직 없어 이 화면은 목업 데이터로만 동작합니다. 업로드・삭제는 실제로 저장되지 않습니다.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {categories.map((c) => (
          <button
            key={c.key}
            className={`filter-chip${active === c.key ? ' active' : ''}`}
            onClick={() => setActive(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="photo-grid">
        {filtered.map((p) => (
          <div className="photo-card" key={p.id}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="9" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4 17L9 12.5L12 15L16 11L20 15.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
            <div className="photo-label">{p.label}</div>
          </div>
        ))}
        <div className="photo-card upload">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          사진 추가
        </div>
      </div>
    </div>
  );
}
