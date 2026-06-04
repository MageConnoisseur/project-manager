/**
 * Main application shell.
 *
 * Combines a fixed sidebar on the left with a scrollable main area on the
 * right. The header sits above the page content; child routes or views will
 * render inside the <main> element in later phases.
 */

import type { ReactNode } from 'react';

import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="app-layout">
      <Sidebar />

      <div className="app-layout__main">
        <Header />
        <main className="app-layout__content">{children}</main>
      </div>
    </div>
  );
}
