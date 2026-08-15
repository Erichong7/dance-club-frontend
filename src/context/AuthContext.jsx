import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, decodeAccessToken, clearTokens, setUnauthorizedHandler } from '../api/client.js';

const AuthContext = createContext(null);

// GET /api/auth/me 호출이 실패하면(네트워크 오류 등), 로그인 응답으로 받은 JWT의 sub(사용자 id)만으로
// 화면이 깨지지 않을 최소 프로필을 만든다. role은 알 수 없으니 USER로 두고 관리자 메뉴는 숨긴다.
function fallbackProfile() {
  const payload = decodeAccessToken();
  if (!payload) return null;
  return {
    id: payload.sub ?? null,
    email: '',
    nickName: `사용자#${payload.sub ?? '?'}`,
    role: 'USER',
    teamIds: [],
    teamNames: [],
    isFallback: true,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authed | guest

  // true를 반환하면 로그인 상태 유지, false면 토큰 자체가 못 쓰는 값(깨진 문자열 등)이라
  // 세션을 정리해야 한다는 뜻. getMe() 실패만으로는 절대 false를 반환하지 않는다 — 그건
  // 그냥 /auth/me 호출이 실패했다는 뜻이고, JWT 디코딩으로 폴백하면 된다.
  const loadProfile = useCallback(async () => {
    try {
      const me = await api.getMe();
      setUser({ ...me, isFallback: false });
      return true;
    } catch {
      const fallback = fallbackProfile();
      if (!fallback) {
        // accessToken이 JWT 형식조차 아닌 경우(예: 예전 목업 로그인이 남긴 문자열).
        // 이 상태로는 영원히 복구가 안 되므로 세션을 지우고 로그인 화면으로 보낸다.
        clearTokens();
        setUser(null);
        return false;
      }
      setUser(fallback);
      return true;
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus('guest');
    });
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) {
      setStatus('guest');
      return;
    }
    loadProfile().then((ok) => setStatus(ok ? 'authed' : 'guest'));
  }, [loadProfile]);

  const login = useCallback(
    async (email, password) => {
      const data = await api.login(email, password);
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      const ok = await loadProfile();
      setStatus(ok ? 'authed' : 'guest');
      if (!ok) throw new Error('로그인 처리 중 문제가 발생했습니다. 다시 시도해 주세요.');
    },
    [loadProfile]
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // 토큰이 이미 만료되었어도 로컬 상태는 정리한다.
    }
    clearTokens();
    setUser(null);
    setStatus('guest');
  }, []);

  const value = {
    user,
    isAuthed: status === 'authed',
    isLoading: status === 'loading',
    isAdmin: user?.role === 'ADMIN',
    login,
    logout,
    refreshProfile: loadProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
