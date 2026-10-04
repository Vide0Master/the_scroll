import { createContext, useContext } from 'react';

export interface NotificationsContextValue {
	/** Notifications the user has not seen yet; kept current by the live stream. */
	unreadCount: number;
	/** Marks everything read, here and on the server. */
	markAllRead: () => Promise<void>;
	/** Marks these (unread) notifications read: what the user opened or otherwise dealt with. */
	markRead: (ids: string[]) => Promise<void>;
}

export const notificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
	const value = useContext(notificationsContext);
	if (!value) {
		throw new Error('useNotifications must be used inside NotificationsProvider');
	}
	return value;
}
