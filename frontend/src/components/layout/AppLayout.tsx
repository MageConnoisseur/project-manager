/**
 * Main application shell.
 *
 * Combines a fixed sidebar on the left with a scrollable main area on the
 * right. On narrow screens the sidebar becomes an off-canvas drawer toggled
 * from the header.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  return (
    <div className="app-layout">
      <button
        type="button"
        className={
          sidebarOpen
            ? 'app-sidebar-backdrop app-sidebar-backdrop--visible'
            : 'app-sidebar-backdrop'
        }
        aria-label="Close menu"
        tabIndex={sidebarOpen ? 0 : -1}
        onClick={closeSidebar}
      />

      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      <div className="app-layout__main">
        <Header onMenuClick={openSidebar} sidebarOpen={sidebarOpen} />
        <main className="app-layout__content">{children}</main>
      </div>
    </div>
  );
}
