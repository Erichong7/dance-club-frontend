import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconCheck } from '../components/Icons.jsx';
import BrandMark from '../components/BrandMark.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// 로그인 실패 code(백엔드 AuthException)별 안내 문구. code가 없는 경우(네트워크 오류 등)는
// err.message를 그대로 보여준다.
const LOGIN_ERROR_MESSAGE = {
  SIGNUP_PENDING: '아직 관리자 승인 대기 중인 계정입니다. 승인 완료 후 다시 로그인해 주세요.',
  SIGNUP_REJECTED: '회원가입이 거절된 계정입니다. 자세한 사유는 관리자에게 문의해 주세요.',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 일치하지 않습니다.',
};

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errorTone, setErrorTone] = useState('err'); // 'err' | 'notice' — 승인 대기는 에러라기보단 안내에 가까워서 톤을 구분
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해 주세요.');
      setErrorTone('err');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(LOGIN_ERROR_MESSAGE[err.code] || err.message || '이메일 또는 비밀번호가 일치하지 않습니다.');
      setErrorTone(err.code === 'SIGNUP_PENDING' ? 'notice' : 'err');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card card">
        <Link to="/" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>← 홈으로</Link>

        <div className="login-brand">
          <BrandMark className="brand-mark" />
          <div className="brand-name">practice.zip</div>
          <div className="brand-sub">연습 일정 관리</div>
        </div>

        <form className="form-grid login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="l-email">이메일</label>
            <input
              id="l-email"
              className="form-input"
              type="email"
              placeholder="example@school.ac.kr"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="l-pw">비밀번호</label>
            <input
              id="l-pw"
              className="form-input"
              type="password"
              placeholder="비밀번호"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className={`validation-msg validation-${errorTone}`}>
              {errorTone === 'notice' ? 'ℹ' : '⚠'} {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={loading ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
          >
            <IconCheck /> {loading ? '로그인 중…' : '로그인'}
          </button>
        </form>

        <p className="login-hint">
          계정이 없으신가요? <Link to="/signup">회원가입</Link>
        </p>
      </div>
    </div>
  );
}
