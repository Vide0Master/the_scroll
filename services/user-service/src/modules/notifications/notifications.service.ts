import type { NotificationItem, NotificationType } from '@the-scroll/types';
import { hub, notificationChannel } from '../../lib/realtime';
import { prisma } from '../../lib/prisma';

const actorSelect = { userID: true, userName: true, visibleName: true, avatarUrl: true } as const;
const LIST_LIMIT = 50;

interface NotificationRow {
	id: string;
	type: NotificationType;
	postID: string | null;
	createdAt: Date;
	readAt: Date | null;
	actor: {
		userID: string;
		userName: string;
		visibleName: string | null;
		avatarUrl: string | null;
	};
}

function toItem(row: NotificationRow): NotificationItem {
	return {
		id: row.id,
		type: row.type,
		actor: row.actor,
		postID: row.postID,
		createdAt: row.createdAt.toISOString(),
		isRead: row.readAt !== null,
	};
}

export interface NewNotification {
	recipientID: string;
	actorID: string;
	type: NotificationType;
	postID?: string;
}

/**
 * Stores a notification and pushes it to the recipient's open tabs. Nothing is created for an
 * action on oneself, nor for a repeated follow or like while an earlier one is still unread.
 */
export async function createNotification(input: NewNotification): Promise<NotificationItem | null> {
	const { recipientID, actorID, type, postID } = input;

	if (recipientID === actorID) {
		return null;
	}

	// A like of the same post (or a follow) that is still unread is not repeated: like, unlike and
	// like again must not fill the list.
	if (type === 'FOLLOW' || type === 'LIKE') {
		const existing = await prisma.notification.findFirst({
			where: {
				recipientID,
				actorID,
				type,
				readAt: null,
				...(type === 'LIKE' ? { postID } : {}),
			},
			select: { id: true },
		});

		if (existing) {
			return null;
		}
	}

	const row = await prisma.notification.create({
		data: { recipientID, actorID, type, postID: postID ?? null },
		include: { actor: { select: actorSelect } },
	});
	const item = toItem(row);

	await hub.publish(notificationChannel(recipientID), item);

	return item;
}

export async function listNotifications(userID: string) {
	const [rows, unreadCount] = await Promise.all([
		prisma.notification.findMany({
			where: { recipientID: userID },
			orderBy: { createdAt: 'desc' },
			take: LIST_LIMIT,
			include: { actor: { select: actorSelect } },
		}),
		countUnread(userID),
	]);

	return { notifications: rows.map(toItem), unreadCount };
}

export function countUnread(userID: string) {
	return prisma.notification.count({ where: { recipientID: userID, readAt: null } });
}

/** Marks read everything unread, or only the notifications in `ids` (never someone else's). */
export async function markRead(userID: string, ids?: string[]) {
	await prisma.notification.updateMany({
		where: { recipientID: userID, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
		data: { readAt: new Date() },
	});

	return countUnread(userID);
}
