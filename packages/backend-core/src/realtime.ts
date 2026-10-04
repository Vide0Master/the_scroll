import { Redis } from 'ioredis';

type Listener = (payload: unknown) => void;

/** Fan-out of small JSON events to whoever listens on a channel, in any instance of a service. */
export interface RealtimeHub {
	publish(channel: string, payload: unknown): Promise<void>;
	/** Resolves to the function that stops the subscription. */
	subscribe(channel: string, listener: Listener): Promise<() => void>;
}

/**
 * Publish/subscribe over Redis, so an event published by one instance reaches listeners held by
 * another. Without a Redis URL, or while Redis is down, it degrades to in-process delivery: the
 * events only reach listeners of the same instance, but nothing throws.
 */
export function createRealtimeHub(redisUrl?: string): RealtimeHub {
	const listeners = new Map<string, Set<Listener>>();
	let publisher: Redis | null = null;
	let subscriber: Redis | null = null;

	const deliver = (channel: string, payload: unknown) => {
		listeners.get(channel)?.forEach((listener) => {
			try {
				listener(payload);
			} catch (error) {
				console.warn('[realtime] a listener failed:', error);
			}
		});
	};

	// A subscribing connection can do nothing else, so publishing gets its own.
	const connect = () => {
		if (!redisUrl || subscriber) {
			return;
		}

		publisher = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
		subscriber = new Redis(redisUrl);
		// Without a handler ioredis prints every reconnect attempt as an unhandled error.
		publisher.on('error', () => undefined);
		subscriber.on('error', () => undefined);
		subscriber.on('message', (channel, message) => {
			try {
				deliver(channel, JSON.parse(message));
			} catch {
				// Not one of ours; ignored.
			}
		});
	};

	return {
		async publish(channel, payload) {
			connect();

			if (publisher) {
				try {
					await publisher.publish(channel, JSON.stringify(payload));
					return;
				} catch {
					// Redis is down: fall through to the listeners of this instance.
				}
			}

			deliver(channel, payload);
		},

		async subscribe(channel, listener) {
			connect();
			const set = listeners.get(channel) ?? new Set<Listener>();

			if (set.size === 0 && subscriber) {
				await subscriber.subscribe(channel).catch(() => undefined);
			}

			set.add(listener);
			listeners.set(channel, set);

			return () => {
				set.delete(listener);

				if (set.size === 0) {
					listeners.delete(channel);
					void subscriber?.unsubscribe(channel).catch(() => undefined);
				}
			};
		},
	};
}
