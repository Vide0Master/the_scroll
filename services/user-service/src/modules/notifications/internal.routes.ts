import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireInternalToken } from '@the-scroll/backend-core';
import { config } from '../../config/env';
import { failResponse, okResponse } from '../../lib/response';
import { createNotification } from './notifications.service';

const batchSchema = z.strictObject({
	items: z
		.array(
			z.strictObject({
				recipientID: z.string().min(1).max(64),
				actorID: z.string().min(1).max(64),
				type: z.enum(['REPLY', 'MENTION', 'LIKE']),
				postID: z.string().min(1).max(64),
			}),
		)
		.max(50),
});

/**
 * Service-to-service routes, under /internal (never proxied to browsers). post-service reports
 * replies, mentions and likes here; follows are created by user-service itself.
 */
export const internalRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.post(
		'/notifications',
		{ preHandler: [requireInternalToken(config.internalApiToken)] },
		async (request, reply) => {
			const parsed = batchSchema.safeParse(request.body);

			if (!parsed.success) {
				return reply
					.code(400)
					.send(failResponse('malformed', 'Notifications are invalid.'));
			}

			// One unknown account must not sink the rest of the batch.
			await Promise.allSettled(parsed.data.items.map((item) => createNotification(item)));

			return reply.code(200).send(okResponse());
		},
	);
};
