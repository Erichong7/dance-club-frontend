// 삭제/제거처럼 되돌릴 수 없는 액션 전에 쓰는 공용 이중 확인 모달.
// src/pages/admin/Members.jsx의 회원 삭제 모달에서 쓰던 .modal-bg/.modal 마크업을 그대로 재사용한다.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '삭제',
  cancelLabel = '취소',
  danger = true,
  loading = false,
  error = '',
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="modal-bg" onClick={loading ? undefined : onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" disabled={loading} onClick={onCancel}>✕</button>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>{message}</p>
        {error && <div className="validation-msg validation-err" style={{ marginBottom: 12 }}>⚠ {error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" disabled={loading} onClick={onCancel}>{cancelLabel}</button>
          <button className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={loading} onClick={onConfirm}>
            {loading ? `${confirmLabel} 중…` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
