/**
 * Login form — email + password.
 *
 * Shows a local error message on failure (never fails silently).
 * A 401 from POST /auth/token stays on this form; the global interceptor
 * only logs out on 401 for protected routes.
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { fetchCurrentUser, loginUser } from '../../api/auth';
import { getAxiosErrorMessage } from '../../api/errors';
import { useAuthStore } from '../../store/authStore';

export function LoginForm() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const tokenResponse = await loginUser(email.trim(), password);
      // Set token before /auth/me so the request interceptor can attach it.
      setAuth(tokenResponse.access_token);
      const user = await fetchCurrentUser();
      setAuth(tokenResponse.access_token, user);
      navigate('/', { replace: true });
    } catch (submitError) {
      const message = getAxiosErrorMessage(submitError, 'Login failed. Please try again.');
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <h2>Log in</h2>
      <p className="auth-form__hint">Use the email and password from your account.</p>

      <label className="auth-form__field">
        <span>Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      <label className="auth-form__field">
        <span>Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      {error && <p className="text-red-500">{error}</p>}

      <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Log in'}
      </button>

      <p className="auth-form__footer">
        No account? <Link to="/signup">Sign up</Link>
      </p>
    </form>
  );
}
