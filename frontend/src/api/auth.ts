/**
 * Authentication API calls (signup, login, current user).
 */

import type { TokenResponse, UserPublic } from '../types';
import { apiClient } from './client';

export interface SignupPayload {
  email: string;
  password: string;
  display_name: string;
}

/** Register a new account — returns public user fields (no token) */
export async function signupUser(payload: SignupPayload): Promise<UserPublic> {
  const { data } = await apiClient.post<UserPublic>('/auth/signup', payload);
  return data;
}

/**
 * Log in with email + password.
 * FastAPI OAuth2 expects form-urlencoded username (email) and password.
 */
export async function loginUser(email: string, password: string): Promise<TokenResponse> {
  const body = new URLSearchParams();
  body.append('username', email);
  body.append('password', password);

  const { data } = await apiClient.post<TokenResponse>('/auth/token', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  return data;
}

/** Load the logged-in user's profile (requires JWT on the request) */
export async function fetchCurrentUser(): Promise<UserPublic> {
  const { data } = await apiClient.get<UserPublic>('/auth/me');
  return data;
}
