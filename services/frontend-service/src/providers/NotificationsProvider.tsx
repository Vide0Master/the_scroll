import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { NotificationItem } from '@the-scroll/types';
import { api } from '../scripts/api';
import { useTranslation } from 'react-i18next';
import { notificationArrived } from '../scripts/events';
import { describeNotification, notificationPath } from '../scripts/notifications';
import { useToast } from './ToastContext';
import { useCurrentUser } from './AuthContext';
import { notificationsContext } from './NotificationsContext';

/**
 * Holds one live connection (server-sent events) for the signed-in user. The server sends the
 * current unread count when it connects, and again after every automatic reconnect, so a missed
 * event can never leave the counter wrong for long.
 */
// A popular post is liked again and again: one toast per post every ten seconds is enough.
const LIKE_TOAST_GAP_MS = 10 * 1000;
const lastLikeToast = new Map<string, number>();

function isLikeBurst(item: NotificationItem): boolean {
	if (item.type !== 'LIKE' || !item.postID) {
		return false;
	}

	const last = lastLikeToast.get(item.postID) ?? 0;
	const isBurst = Date.now() - last < LIKE_TOAST_GAP_MS;

	if (!isBurst) {
		lastLikeToast.set(item.postID, Date.now());
	}

	return isBurst;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
	const { user } = useCurrentUser();
	const userID = user?.userID;
	const [unreadCount, setUnreadCount] = useState(0);
	const { t } = useTranslation();
	const { show, areEventToastsEnabled } = useToast();
	const markRead = useCallback(async (ids: string[]) => {
		if (ids.length === 0) {
			return;
		}

		// Shown at once; the server's count then settles it.
		setUnreadCount((count) => Math.max(0, count - ids.length));
		const response = await api.notifications.readAll(ids).catch(() => null);

		if (typeof response?.unreadCount === 'number') {
			setUnreadCount(response.unreadCount);
		}
	}, []);

	// Read inside the stream handler, which must not reconnect when these change.
	const live = useRef({ t, show, areEventToastsEnabled, markRead });

	useEffect(() => {
		live.current = { t, show, areEventToastsEnabled, markRead };
	});

	useEffect(() => {
		if (!userID) {
			return;
		}

		const source = new EventSource('/api/notifications/stream');

		source.addEventListener('unread', (event) => {
			setUnreadCount(
				(JSON.parse((event as MessageEvent).data) as { unreadCount: number }).unreadCount,
			);
		});
		source.addEventListener('notification', (event) => {
			const item = JSON.parse((event as MessageEvent).data) as NotificationItem;

			setUnreadCount((count) => count + 1);
			notificationArrived.emit(item);

			// The notifications page adds it to its list itself; anywhere else a toast announces it.
			if (
				live.current.areEventToastsEnabled &&
				window.location.pathname !== '/notifications' &&
				!isLikeBurst(item)
			) {
				live.current.show({
					kind: 'event',
					message: describeNotification(live.current.t, item),
					to: notificationPath(item),
					// Opening it from the toast counts as reading it.
					onOpen: () => void live.current.markRead([item.id]),
				});
			}
		});

		return () => source.close();
	}, [userID]);

	const markAllRead = useCallback(async () => {
		setUnreadCount(0);
		await api.notifications.readAll().catch(() => undefined);
	}, []);

	return (
		<notificationsContext.Provider
			value={{ unreadCount: userID ? unreadCount : 0, markAllRead, markRead }}
		>
			{children}
		</notificationsContext.Provider>
	);
}
