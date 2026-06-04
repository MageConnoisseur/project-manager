/**
 * Route guard for pages that require a logged-in user.
 *
 * Redirects to /login when there is no JWT in authStore.
 */

import { Navigate, Outlet } from 'react-router-dom';

import { useAuthStore } from '../store/authStore';

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
