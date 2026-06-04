/**
 * Application routes and navigation registration for Axios 401 handling.
 */

import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';

import { NotificationBanner } from '../components/common/NotificationBanner';
import { AppLayout } from '../components/layout/AppLayout';
import { registerAuthNavigation } from '../api/navigation';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { SignupPage } from '../pages/SignupPage';
import { ProtectedRoute } from './ProtectedRoute';

/**
 * Connects React Router's navigate function to the Axios interceptor.
 */
function AuthNavigationBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    registerAuthNavigation(navigate);
  }, [navigate]);

  return null;
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthNavigationBridge />
      <NotificationBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route element={<ProtectedRoute />}>
          <Route
            element={
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            }
            path="/"
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
