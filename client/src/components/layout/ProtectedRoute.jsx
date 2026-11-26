import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Skeleton } from '../ui';

const ROLE_HOME = {
  super_admin: '/master-control',
  school_admin: '/admin',
  faculty: '/faculty',
  student: '/student',
};

export function ProtectedRoute({ allowedRoles, children }) {
  const { user, school, loading, logout } = useAuth();
  const location = useLocation();
  const [pausedInfo, setPausedInfo] = useState(null);

  useEffect(() => {
    const handler = (e) => setPausedInfo(e.detail || { message: 'Service paused. Please contact your service provider.' });
    window.addEventListener('schll:service-paused', handler);
    return () => window.removeEventListener('schll:service-paused', handler);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    if (location.pathname.startsWith('/master-control') || location.pathname.startsWith('/superadmin')) {
      return <Navigate to="/master-control/login" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'parent') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">This account type is not available</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Parent portal access is currently disabled. Please sign in with a Student, Faculty, or Admin account.
          </p>
          <button
            type="button"
            onClick={() => logout()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 cursor-pointer"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (allowedRoles.includes('super_admin')) {
      return <Navigate to="/master-control/login" replace />;
    }
    return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
  }

  if (user.role !== 'super_admin' && (pausedInfo || school?.subscription?.code === 'SCHOOL_PAUSED')) {
    const details = pausedInfo?.details || {};
    const msg = pausedInfo?.message || school?.subscription?.reason || 'Service paused. Please contact your service provider.';
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full rounded-2xl border border-amber-300 dark:border-amber-900 bg-white dark:bg-slate-900 p-6 text-center space-y-4 shadow-sm">
          <div className="mx-auto inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950/60 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
            SERVICE PAUSED
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Service Paused</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{msg}</p>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <p>Please contact your service provider:</p>
            <p className="font-medium text-slate-700 dark:text-slate-200">
              {details.supportEmail || 'billing@schoolcloud.io'} · {details.supportPhone || '+1-800-555-0199'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPausedInfo(null);
              logout();
            }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // If school_admin's school is suspended/expired, lock them to /admin/subscription
  if (
    user.role === 'school_admin' &&
    school?.subscription?.isBlocked &&
    location.pathname !== '/admin/subscription'
  ) {
    return <Navigate to="/admin/subscription" replace />;
  }

  return children;
}

export function RoleRedirect() {
  const { user, school, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'school_admin' && school?.subscription?.isBlocked) {
    return <Navigate to="/admin/subscription" replace />;
  }
  return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
}
