/**
 * Authentication state (Zustand).
 *
 * Holds whether the user is logged in, their JWT access token, and basic
 * profile info from GET /auth/me. The Axios client reads the token here and
 * attaches it to every API request. A 401 response clears this store and
 * redirects to /login via the response interceptor.
 */

import { create } from 'zustand';

import type { UserPublic } from '../types';

/** Everything we keep in memory for the current session */
interface AuthState {
  /** True when we have a valid token and user profile loaded */
  isAuthenticated: boolean;
  /** JWT from POST /auth/token — sent as Authorization: Bearer <token> */
  token: string | null;
  /** Profile from signup or GET /auth/me */
  user: UserPublic | null;
}

/** Actions callers use to update auth state */
interface AuthActions {
  /**
   * Call after a successful login when the API returns a token.
   * Pass the user object when you already have it, or load it with fetchCurrentUser.
   */
  setAuth: (token: string, user?: UserPublic) => void;
  /** Replace only the user profile (e.g. after GET /auth/me) */
  setUser: (user: UserPublic) => void;
  /** Clear token and user — used by Logout and the Axios 401 interceptor */
  logout: () => void;
}

export type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  isAuthenticated: false,
  token: null,
  user: null,
};

export const useAuthStore = create<AuthStore>((set) => ({
  ...initialState,

  setAuth: (token, user) => {
    set({
      token,
      isAuthenticated: true,
      user: user ?? null,
    });
  },

  setUser: (user) => {
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    set({ ...initialState });
  },
}));
