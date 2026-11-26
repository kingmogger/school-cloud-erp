import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [school, setSchool] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem('schll_access_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.data.user);
      setSchool(res.data.data.school || null);
      setProfile(res.data.data.profile || null);
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        localStorage.removeItem('schll_access_token');
        localStorage.removeItem('schll_refresh_token');
        setUser(null);
        setSchool(null);
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
    const onUnauthorized = () => {
      setUser(null);
      setSchool(null);
      setProfile(null);
    };
    window.addEventListener('schll:unauthorized', onUnauthorized);
    return () => window.removeEventListener('schll:unauthorized', onUnauthorized);
  }, [loadMe]);

  const login = async (email, password, schoolCode = '') => {
    const res = await api.post('/auth/login', {
      email,
      password,
      ...(schoolCode ? { schoolCode } : {}),
    });
    const { accessToken, refreshToken, user: loggedUser, school: loggedSchool, profile: loggedProfile } = res.data.data;
    localStorage.setItem('schll_access_token', accessToken);
    localStorage.setItem('schll_refresh_token', refreshToken);
    setUser(loggedUser);
    setSchool(loggedSchool || null);
    setProfile(loggedProfile || null);
    return { user: loggedUser, school: loggedSchool };
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    localStorage.removeItem('schll_access_token');
    localStorage.removeItem('schll_refresh_token');
    sessionStorage.removeItem('schll_super_backup');
    setUser(null);
    setSchool(null);
    setProfile(null);
  };

  const startImpersonation = async (impersonationData) => {
    const backup = {
      accessToken: localStorage.getItem('schll_access_token'),
      refreshToken: localStorage.getItem('schll_refresh_token'),
    };
    sessionStorage.setItem('schll_super_backup', JSON.stringify(backup));
    localStorage.setItem('schll_access_token', impersonationData.accessToken);
    localStorage.removeItem('schll_refresh_token');
    await loadMe();
  };

  const exitImpersonation = async () => {
    const raw = sessionStorage.getItem('schll_super_backup');
    if (raw) {
      const backup = JSON.parse(raw);
      if (backup.accessToken) localStorage.setItem('schll_access_token', backup.accessToken);
      if (backup.refreshToken) localStorage.setItem('schll_refresh_token', backup.refreshToken);
      sessionStorage.removeItem('schll_super_backup');
      await loadMe();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        school,
        profile,
        loading,
        login,
        logout,
        reloadUser: loadMe,
        startImpersonation,
        exitImpersonation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
