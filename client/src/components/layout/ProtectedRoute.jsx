import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Skeleton } from '../ui';

const ROLE_HOME = {
  super_admin: '/master-control',
  school_admin: '/admin',
  faculty: '/faculty',
  student: '/student',
  parent: '/parent',
};

export function ProtectedRoute({ allowedRoles, children }) {
  const { user, school, loading } = useAuth();
  const location = useLocation();

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

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (allowedRoles.includes('super_admin')) {
      return <Navigate to="/master-control/login" replace />;
    }
    return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
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
