import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconCheck } from '../components/Icons.jsx';
import BrandMark from '../components/BrandMark.jsx';
import { api } from '../api/client.js';

const initialForm = { email: '', nickname: '', password: '', passwordConfirm: '', phoneNumber: '' };
const PHONE_PATTERN = /^01[016789]-\d{3,4}-\d{4}$/;

function validate(form) {
  const errors = [];
  if (form.password && form.password.length < 8) errors.push('비밀번호는 최소 8자 이상이어야 합니다.');
  if (form.passwordConfirm && form.password !== form.passwordConfirm) errors.push('비밀번호가 일치하지 않습니다.');
  if (form.phoneNumber && !PHONE_PATTERN.test(form.phoneNumber)) {
    errors.push('휴대폰 번호 형식이 올바르지 않습니다 (예: 010-1234-5678).');
  }
  return errors;
}

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const errors = validate(form);
  const isComplete = Object.values(form).every((v) => v !== '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isComplete || errors.length > 0) return;

    setError('');
    setLoading(true);
    try {
      await api.signup(form.email, form.password, form.passwordConfirm, form.nickname, form.phoneNumber);
      setDone(true);
    } catch (err) {
      setError(err.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="login-screen">
        <div className="login-card card" style={{ textAlign: 'center' }}>
          <div className="login-brand">
            <BrandMark className="brand-mark" />
            <div className="brand-name">회원가입 신청 완료</div>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', margin: '4px 0 20px' }}>
            관리자 승인 후 로그인할 수 있습니다. 승인 전에 로그인을 시도하면 승인 대기 안내가 표시됩니다.
          </p>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/login')}>
            로그인 화면으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card card">
        <Link to="/login" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>← 로그인 화면으로</Link>

        <div className="login-brand">
          <BrandMark className="brand-mark" />
          <div className="brand-name">practice.zip</div>
          <div className="brand-sub">회원가입</div>
        </div>

        <form className="form-grid login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="s-email">이메일</label>
            <input
              id="s-email"
              className="form-input"
              type="email"
              placeholder="example@school.ac.kr"
              autoComplete="username"
              value={form.email}
              onChange={update('email')}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="s-nickname">닉네임</label>
            <input
              id="s-nickname"
              className="form-input"
              type="text"
              placeholder="홍길동"
              value={form.nickname}
              onChange={update('nickname')}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="s-phone">휴대폰 번호</label>
            <input
              id="s-phone"
              className="form-input"
              type="tel"
              placeholder="010-1234-5678"
              autoComplete="tel"
              value={form.phoneNumber}
              onChange={update('phoneNumber')}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="s-pw">비밀번호</label>
            <input
              id="s-pw"
              className="form-input"
              type="password"
              placeholder="최소 8자"
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="s-pw2">비밀번호 확인</label>
            <input
              id="s-pw2"
              className="form-input"
              type="password"
              placeholder="비밀번호 확인"
              autoComplete="new-password"
              value={form.passwordConfirm}
              onChange={update('passwordConfirm')}
            />
          </div>

          {(error || (isComplete && errors.length > 0)) && (
            <div className="validation-msg validation-err">
              {error && <div>⚠ {error}</div>}
              {isComplete && errors.map((m) => <div key={m}>⚠ {m}</div>)}
            </div>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || !isComplete || errors.length > 0}
            style={loading || !isComplete || errors.length > 0 ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
          >
            <IconCheck /> {loading ? '가입 중…' : '가입하기'}
          </button>
        </form>

        <p className="login-hint">
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </p>
      </div>
    </div>
  );
}
