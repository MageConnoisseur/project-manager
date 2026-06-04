/**
 * Global notification state (Zustand).
 *
 * The Axios response interceptor pushes server and network errors here so
 * the user always sees feedback when something fails outside a form.
 */

import { create } from 'zustand';

export type NotificationKind = 'error' | 'info' | 'success';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  message: string;
}

interface NotificationState {
  /** Active toast-style messages shown at the top of the app */
  notifications: AppNotification[];
}

interface NotificationActions {
  /** Show a red error banner (used for 500s and network failures) */
  showError: (message: string) => void;
  /** Remove one notification by id (auto-dismiss or manual close) */
  dismiss: (id: string) => void;
  /** Clear every notification */
  clearAll: () => void;
}

export type NotificationStore = NotificationState & NotificationActions;

let nextId = 1;

function createNotification(kind: NotificationKind, message: string): AppNotification {
  return {
    id: `notification-${nextId++}`,
    kind,
    message,
  };
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],

  showError: (message) => {
    const notification = createNotification('error', message);
    set((state) => ({
      notifications: [...state.notifications, notification],
    }));

    // Auto-hide after 8 seconds so old errors do not stack forever.
    window.setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((item) => item.id !== notification.id),
      }));
    }, 8000);
  },

  dismiss: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== id),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
  },
}));
