import { useId } from 'react';

// practice.zip 로고 마크: 기존 브랜드마크(보라 사각형 + 대각선 스텝)에 파일 아이콘의
// "접힌 모서리"를 얹어 이름의 .zip을 은유한다. 40x40 기준 뷰박스라 어느 크기로 써도
// 사이드바(38px)·파비콘(16px)에서 동일한 비율로 보인다.
export default function BrandMark({ size = 38, className }) {
  const clipId = useId();

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      style={{ display: 'block', borderRadius: 'var(--radius-md)', flexShrink: 0 }}
    >
      <clipPath id={clipId}>
        <rect width="40" height="40" rx="10" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect width="40" height="40" fill="var(--color-stage)" />
        <path d="M26 0 L40 0 L40 14 Z" fill="var(--color-stage-dark)" />
        <line x1="26" y1="0" x2="40" y2="14" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <line x1="13" y1="29" x2="22" y2="10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <line x1="9" y1="30.5" x2="26" y2="30.5" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
