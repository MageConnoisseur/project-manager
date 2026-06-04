/**
 * Bridge between Axios interceptors and React Router.
 *
 * Interceptors run outside React, so we register a redirect function once
 * from AppRoutes (where useNavigate is available).
 */

type NavigateFn = (path: string) => void;

let navigateFn: NavigateFn | null = null;

/** Call once from a component inside BrowserRouter */
export function registerAuthNavigation(navigate: NavigateFn): void {
  navigateFn = navigate;
}

/** Send the user to the login screen after a 401 on a protected API call */
export function redirectToLogin(): void {
  if (navigateFn) {
    navigateFn('/login');
    return;
  }

  // Fallback if the router has not mounted yet (should be rare).
  window.location.assign('/login');
}
