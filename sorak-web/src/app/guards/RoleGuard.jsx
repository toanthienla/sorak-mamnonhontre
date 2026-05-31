import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../shared/stores/auth.store';

export function RoleGuard({ children, roles }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }
  return <>{children}</>;
}
