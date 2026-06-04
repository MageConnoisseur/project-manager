/**
 * Central Axios HTTP client for the FastAPI backend.
 *
 * Request interceptor: attach JWT from authStore.
 * Response interceptor: 401 → logout + login redirect; 500 / network → global notification.
 */

import axios from 'axios';

import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { redirectToLogin } from './navigation';

/** Local FastAPI server — override with VITE_API_BASE_URL in production */
const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Login and signup may return 401/400 — those must show on the form, not log the user out.
 */
function isPublicAuthRequest(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  return url.includes('/auth/token') || url.includes('/auth/signup');
}

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url ?? '';

    // --- 401: expired or invalid token on a protected route ---
    if (status === 401 && !isPublicAuthRequest(requestUrl)) {
      console.warn('[API] Session expired or unauthorized — clearing auth and redirecting to login');
      useAuthStore.getState().logout();
      redirectToLogin();
      return Promise.reject(error);
    }

    // --- Network: no response object (offline, DNS, connection refused) ---
    if (!error.response) {
      console.error('[API] Network error:', error.message, { url: requestUrl });
      useNotificationStore.getState().showError(
        'Network error. Check your connection and try again.',
      );
      return Promise.reject(error);
    }

    // --- 500+ server errors: inform the user globally ---
    if (status >= 500) {
      console.error('[API] Server error:', status, error.response.data, { url: requestUrl });
      useNotificationStore.getState().showError(
        'Server error. Please try again later.',
      );
      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);
