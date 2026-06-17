/**
 * Top header bar for the main content area.
 *
 * Shows whether the user is logged in, their display name or email,
 * and a Logout button that clears auth state and returns to /login.
 * On narrow screens, includes a menu button to open the sidebar drawer.
 */

import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../store/authStore';

interface HeaderProps {
  onMenuClick: () => void;
  sidebarOpen: boolean;
}

export function Header({ onMenuClick, sidebarOpen }: HeaderProps) {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const statusLabel = isAuthenticated
    ? `Signed in as ${user?.display_name ?? user?.email ?? 'User'}`
    : 'Not signed in';

  return (
    <header className="app-header">
      <div className="app-header__start">
        <button
          type="button"
          className="app-header__menu-btn"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          aria-expanded={sidebarOpen}
          aria-controls="app-sidebar"
        >
          <span className="app-header__menu-icon" aria-hidden="true" />
        </button>

        <div className="app-header__info">
          <span className="app-header__label">Account</span>
          <span className="app-header__status">{statusLabel}</span>
          {isAuthenticated && user?.email && (
            <span className="app-header__email">{user.email}</span>
          )}
        </div>
      </div>

      {isAuthenticated && (
        <button type="button" className="app-header__logout" onClick={handleLogout}>
          Logout
        </button>
      )}
    </header>
  );
}
