import type { FeedPost, NotificationItem } from '@the-scroll/types';

// A tiny typed layer over `window` events: components far apart (the side-nav composer and the
// open feed, the live stream and the notifications page) talk without importing each other.

function bus<T>(name: string) {
	return {
		emit: (detail: T) => window.dispatchEvent(new CustomEvent<T>(name, { detail })),
		/** Subscribes; returns the function that unsubscribes. */
		on: (listener: (detail: T) => void) => {
			const handler = (event: Event) => listener((event as CustomEvent<T>).detail);
			window.addEventListener(name, handler);
			return () => window.removeEventListener(name, handler);
		},
	};
}

/** A post or reply the signed-in user just created (the open feed shows it at once). */
export const postCreated = bus<FeedPost>('scroll:post-created');

/** A live notification arrived over the stream. */
export const notificationArrived = bus<NotificationItem>('scroll:notification');
