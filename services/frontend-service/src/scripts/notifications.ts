import type { TFunction } from 'i18next';
import type { NotificationItem } from '@the-scroll/types';
import { postPath, profilePath } from './routes';

/** One line of text for a notification ("X replied to your post"). */
export function describeNotification(t: TFunction, item: NotificationItem): string {
	const name = item.actor?.visibleName || item.actor?.userName || '…';

	return t(`notifications.${item.type.toLowerCase()}`, { name });
}

/** Where a notification leads: the post it is about, else the profile of who caused it. */
export function notificationPath(item: NotificationItem): string {
	return item.postID
		? postPath(item.postID)
		: item.actor
			? profilePath(item.actor.userName)
			: '/';
}

/** One row of the list: a single notification, or several likes of the same post together. */
export interface NotificationGroup {
	key: string;
	/** The newest notification of the group (its time, post and first actor are shown). */
	latest: NotificationItem;
	items: NotificationItem[];
	isRead: boolean;
}

/**
 * Likes of the same post become one row ("Ann and 3 more liked your post"); everything else stays
 * as it is. Rows keep the order of their newest notification. `items` come newest first.
 */
export function groupNotifications(items: NotificationItem[]): NotificationGroup[] {
	const groups: NotificationGroup[] = [];
	const likeGroups = new Map<string, NotificationGroup>();

	for (const item of items) {
		const likeKey = item.type === 'LIKE' && item.postID ? `like:${item.postID}` : null;
		const existing = likeKey ? likeGroups.get(likeKey) : undefined;

		if (existing) {
			existing.items.push(item);
			existing.isRead = existing.isRead && item.isRead;
			continue;
		}

		const group: NotificationGroup = {
			key: likeKey ?? item.id,
			latest: item,
			items: [item],
			isRead: item.isRead,
		};
		groups.push(group);

		if (likeKey) {
			likeGroups.set(likeKey, group);
		}
	}

	return groups;
}

/** The text of a row: the one notification, or "A and N more liked your post". */
export function describeGroup(t: TFunction, group: NotificationGroup): string {
	if (group.items.length === 1) {
		return describeNotification(t, group.latest);
	}

	const name = group.latest.actor?.visibleName || group.latest.actor?.userName || '…';

	return t('notifications.likeMany', { name, n: group.items.length - 1 });
}
