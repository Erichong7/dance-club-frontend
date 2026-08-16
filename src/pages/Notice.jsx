import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

function formatDate(iso) {
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}

function NoticeList() {
  const { isAdmin, isAuthed } = useAuth();
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ content: [], totalPages: 1, first: true, last: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [writing, setWriting] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.getPosts(page, 10)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page]);

  const submitPost = async () => {
    if (!form.title || !form.content) return;
    setSaving(true);
    setError('');
    try {
      await api.createPost(form.title, form.content);
      setForm({ title: '', content: '' });
      setWriting(false);
      setPage(0);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">공지사항</div>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={() => setWriting((v) => !v)}>
            {writing ? '취소' : '+ 공지 작성'}
          </button>
        )}
      </div>

      {!isAuthed && (
        <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 12 }}>
          공지사항은 로그인 없이도 볼 수 있습니다. 신청·관리 기능을 사용하려면 <Link to="/login">로그인</Link>해 주세요.
        </p>
      )}

      {writing && (
        <div className="form-grid" style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
          <div className="form-group full">
            <label className="form-label">제목</label>
            <input className="form-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="form-group full">
            <label className="form-label">내용</label>
            <textarea
              className="form-input"
              rows={4}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
          </div>
          <div className="form-group full">
            <button className="btn btn-primary btn-sm" disabled={saving || !form.title || !form.content} onClick={submitPost}>
              {saving ? '등록 중…' : '등록'}
            </button>
          </div>
        </div>
      )}

      {error && <div className="validation-msg validation-err">⚠ {error}</div>}
      {loading && <p style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>불러오는 중…</p>}
      {!loading && data.content.length === 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>등록된 공지가 없습니다.</p>
      )}

      {data.content.map((n) => (
        <Link to={`/notice/${n.id}`} className="notice-row" key={n.id} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ flex: 1 }}>
            <div className="notice-title">{n.title}</div>
            <div className="notice-meta">{n.nickname} · {formatDate(n.createdAt)}</div>
          </div>
        </Link>
      ))}

      {data.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button className="btn btn-sm" disabled={data.first} onClick={() => setPage((p) => p - 1)}>이전</button>
          <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
            {page + 1} / {data.totalPages}
          </span>
          <button className="btn btn-sm" disabled={data.last} onClick={() => setPage((p) => p + 1)}>다음</button>
        </div>
      )}
    </div>
  );
}

function NoticeDetail({ id }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    api.getPost(id)
      .then((p) => { setPost(p); setForm({ title: p.title, content: p.content }); })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [id]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.updatePost(id, form.title, form.content);
      setEditing(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await api.deletePost(id);
      navigate('/notice');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (error && !post) return <div className="card"><div className="validation-msg validation-err">⚠ {error}</div></div>;
  if (!post) return <div className="card">불러오는 중…</div>;

  return (
    <div className="card" style={{ maxWidth: 680 }}>
      <div className="card-header">
        <Link to="/notice" className="btn btn-ghost btn-sm">← 목록으로</Link>
        {isAdmin && !editing && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={() => setEditing(true)}>수정</button>
            <button className="btn btn-sm" onClick={() => { setError(''); setConfirmingDelete(true); }}>삭제</button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="게시글 삭제"
        message="이 게시글을 정말 삭제하시겠습니까? 되돌릴 수 없습니다."
        loading={deleting}
        error={error}
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) { setConfirmingDelete(false); setError(''); } }}
      />

      {!confirmingDelete && error && <div className="validation-msg validation-err">⚠ {error}</div>}

      {editing ? (
        <div className="form-grid">
          <div className="form-group full">
            <label className="form-label">제목</label>
            <input className="form-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="form-group full">
            <label className="form-label">내용</label>
            <textarea className="form-input" rows={6} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
          </div>
          <div className="form-group full" style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>{saving ? '저장 중…' : '저장'}</button>
            <button className="btn btn-sm" onClick={() => setEditing(false)}>취소</button>
          </div>
        </div>
      ) : (
        <>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 19, marginBottom: 6 }}>{post.title}</h2>
          <div className="notice-meta" style={{ marginBottom: 16 }}>
            {post.nickname} · {formatDate(post.createdAt)}
            {post.updatedAt !== post.createdAt && ` (수정됨 ${formatDate(post.updatedAt)})`}
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{post.content}</p>
        </>
      )}
    </div>
  );
}

export default function Notice() {
  const { id } = useParams();
  return id ? <NoticeDetail id={id} /> : <NoticeList />;
}
