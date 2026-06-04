/**
 * Public signup page — no sidebar, centered form only.
 */

import { SignupForm } from '../components/auth/SignupForm';

export function SignupPage() {
  return (
    <div className="auth-page">
      <SignupForm />
    </div>
  );
}
