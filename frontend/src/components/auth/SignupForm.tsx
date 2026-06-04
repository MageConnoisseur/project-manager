/**
 * Signup form — display name, email, password.
 *
 * On success we log the user in automatically, then redirect to the dashboard.
 * Every failure sets local error text from the API response.
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { fetchCurrentUser, loginUser, signupUser } from '../../api/auth';
import { getAxiosErrorMessage } from '../../api/errors';
import { useAuthStore } from '../../store/authStore';

export function SignupForm() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signupUser({
        email: email.trim(),
        password,
        display_name: displayName.trim(),
      });

      const tokenResponse = await loginUser(email.trim(), password);
      useAuthStore.getState().setAuth(tokenResponse.access_token);
      const user = await fetchCurrentUser();
      setAuth(tokenResponse.access_token, user);
      navigate('/', { replace: true });
    } catch (submitError) {
      const message = getAxiosErrorMessage(submitError, 'Sign up failed. Please try again.');
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <h2>Create account</h2>

      <label className="auth-form__field">
        <span>Display name</span>
        <input
          type="text"
          name="displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
        />
      </label>

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
        <span>Password (min. 8 characters)</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      {error && <p className="text-red-500">{error}</p>}

      <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account…' : 'Sign up'}
      </button>

      <p className="auth-form__footer">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </form>
  );
}
