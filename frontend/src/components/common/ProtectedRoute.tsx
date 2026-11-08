import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import type { Rol } from '../../types/roles';

interface ProtectedRouteProps {
  allowedRoles: Rol[];
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to login if not authenticated
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  if (user && user.roles) {
    const hasAllowedRole = user.roles.some((r) => allowedRoles.includes(r as Rol));
    if (!hasAllowedRole) {
      // Redirect to home if user does not have permission
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};
