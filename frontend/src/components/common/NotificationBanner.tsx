/**
 * Global notification banner stack.
 *
 * Renders messages from notificationStore (populated by the Axios interceptor
 * for 500 and network errors). Each item can be dismissed manually.
 */

import { useNotificationStore } from '../../store/notificationStore';

export function NotificationBanner() {
  const notifications = useNotificationStore((state) => state.notifications);
  const dismiss = useNotificationStore((state) => state.dismiss);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-stack" role="status" aria-live="polite">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={
            notification.kind === 'error'
              ? 'notification notification--error'
              : 'notification'
          }
        >
          <p className="notification__message">{notification.message}</p>
          <button
            type="button"
            className="notification__dismiss"
            onClick={() => dismiss(notification.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
