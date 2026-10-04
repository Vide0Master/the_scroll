import { INTERNAL_TOKEN_HEADER } from '@the-scroll/backend-core';

export interface PostNotification {
	recipientID: string;
	actorID: string;
	type: 'REPLY' | 'MENTION' | 'LIKE';
	postID: string;
}

/** Tells user-service about things that happened to people because of a post. */
export interface Notifier {
	send(items: PostNotification[]): Promise<void>;
}

/**
 * Best effort by design: a post is already saved when this runs, and losing a notification is
 * better than failing (or slowing down) the post, so errors are only logged.
 */
export function createNotifier(options: { url: string; token?: string }): Notifier {
	return {
		async send(items) {
			if (items.length === 0 || !options.token) {
				return;
			}

			try {
				const response = await fetch(`${options.url}/internal/notifications`, {
					method: 'POST',
					headers: {
						// eslint-disable-next-line @typescript-eslint/naming-convention
						'Content-Type': 'application/json',
						[INTERNAL_TOKEN_HEADER]: options.token,
					},
					body: JSON.stringify({ items }),
				});

				if (!response.ok) {
					console.error(`Notifications were refused: status ${response.status}`);
				}
			} catch (error) {
				console.error('Failed to send notifications:', error);
			}
		},
	};
}
