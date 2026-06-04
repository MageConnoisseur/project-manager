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

/**
 * Where API requests go.
 * - Local dev: defaults to http://127.0.0.1:8000 if unset
 * - Vercel: MUST set VITE_API_BASE_URL to your Render URL in project env vars
 */
const baseURL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:8000';

const isProductionHost =
  typeof window !== 'undefined' &&
  !window.location.hostname.includes('localhost') &&
  !window.location.hostname.includes('127.0.0.1');

const isApiUrlMisconfigured =
  isProductionHost &&
  (!import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_BASE_URL.includes('localhost'));

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Render free tier can take ~30s to wake; avoid instant "network error" on cold start.
  timeout: 60_000,
});

/**
 * Build a helpful message when the browser never got an HTTP response (CORS, wrong URL, offline).
 */
export function getNetworkErrorHint(): string {
  if (isApiUrlMisconfigured) {
    return (
      'API URL is not configured for production. In Vercel, set VITE_API_BASE_URL to your ' +
      'Render URL (e.g. https://your-app.onrender.com), then redeploy the frontend.'
    );
  }

  return (
    `Cannot reach the API at ${baseURL}. ` +
    'Check that Render is running (/health), DATABASE_URL is set, and CORS_ORIGINS on Render ' +
    'includes this site (or CORS_ALLOW_VERCEL=true).'
  );
}

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

    // --- Network: no response (wrong API URL, CORS blocked, server down, timeout) ---
    if (!error.response) {
      const hint = getNetworkErrorHint();
      console.error('[API] Network error:', error.message, { baseURL, url: requestUrl });
      useNotificationStore.getState().showError(hint);
      return Promise.reject(error);
    }

    // --- Database / server unavailable ---
    if (status === 503) {
      const detail =
        typeof error.response.data?.detail === 'string'
          ? error.response.data.detail
          : 'Service temporarily unavailable.';
      useNotificationStore.getState().showError(detail);
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
