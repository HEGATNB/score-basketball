import { Navigate, useLocation } from 'react-router-dom';
import { LoadingSpinner } from '../shared/ui/LoadingSpinner';
import { useAuth } from './providers/AuthProvider';

interface ProtectedRouteProps {
  children: JSX.Element;
  roles?: string[];
}

export const ProtectedRoute = ({ children, roles = [] }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};
