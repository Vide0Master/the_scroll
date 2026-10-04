import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { hub, notificationChannel } from '../../lib/realtime';
import { failResponse, okResponse } from '../../lib/response';
import { countUnread, listNotifications, markRead } from './notifications.service';

// No body marks everything read; `ids` only those notifications.
const readSchema = z.strictObject({ ids: z.array(z.string().min(1).max(64)).max(100).optional() });

const KEEP_ALIVE_MS = 25_000;

/** A user's own notifications: list, mark read, and a live stream. Registered under /notifications. */
export const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
	const guard = { preHandler: [fastify.authenticate] };

	fastify.get('/', guard, async (request, reply) => {
		return reply.code(200).send(await listNotifications(request.user!.userID));
	});

	fastify.post('/read', guard, async (request, reply) => {
		const parsed = readSchema.safeParse(request.body ?? {});

		if (!parsed.success) {
			return reply.code(400).send(failResponse('malformed', 'Notification ids are invalid.'));
		}

		const unreadCount = await markRead(request.user!.userID, parsed.data.ids);
		return reply.code(200).send(okResponse({ unreadCount }));
	});

	/**
	 * Server-sent events: `unread` once on connect (the current count), then a `notification` per
	 * new one. The browser reconnects by itself, which re-sends the count and so heals any gap.
	 */
	fastify.get('/stream', guard, async (request, reply) => {
		const userID = request.user!.userID;

		reply.hijack();
		const response = reply.raw;
		response.writeHead(200, {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			'Content-Type': 'text/event-stream',
			// eslint-disable-next-line @typescript-eslint/naming-convention
			'Cache-Control': 'no-cache, no-transform',
			// eslint-disable-next-line @typescript-eslint/naming-convention
			Connection: 'keep-alive',
			// Tells reverse proxies not to buffer the stream.
			// eslint-disable-next-line @typescript-eslint/naming-convention
			'X-Accel-Buffering': 'no',
		});

		const send = (event: string, data: unknown) => {
			response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
		};

		response.write('retry: 3000\n\n');
		const unsubscribe = await hub.subscribe(notificationChannel(userID), (payload) =>
			send('notification', payload),
		);
		send('unread', { unreadCount: await countUnread(userID) });

		// A comment line now and then keeps idle connections from being closed on the way.
		const keepAlive = setInterval(() => response.write(': ping\n\n'), KEEP_ALIVE_MS);

		request.raw.on('close', () => {
			clearInterval(keepAlive);
			unsubscribe();
		});
	});
};
