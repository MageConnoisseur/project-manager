/**
 * Helpers for reading error messages from Axios / FastAPI responses.
 *
 * Form components use these in catch blocks so users see the real API detail
 * instead of a generic "Request failed" string.
 */

import axios from 'axios';

import { getNetworkErrorHint } from './client';

/** Shape FastAPI often returns: { detail: "message" } or { detail: [{ msg: "..." }] } */
function detailToString(detail: unknown): string | null {
  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === 'object' && item !== null && 'msg' in item) {
          return String((item as { msg: string }).msg);
        }
        return String(item);
      })
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join('. ');
    }
  }

  return null;
}

/**
 * Turn any thrown value into a short message suitable for form error text.
 */
export function getAxiosErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return getNetworkErrorHint();
    }

    const fromDetail = detailToString(error.response.data?.detail);
    if (fromDetail) {
      return fromDetail;
    }

    if (typeof error.response.data === 'string') {
      return error.response.data;
    }

    if (error.response.status >= 500) {
      return 'Server error. Please try again later.';
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

/**
 * True when the request never reached the server (offline, CORS, timeout).
 */
export function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response === undefined;
}

/**
 * True when FastAPI returned 401 Unauthorized on a protected route.
 */
export function isUnauthorizedError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401;
}
