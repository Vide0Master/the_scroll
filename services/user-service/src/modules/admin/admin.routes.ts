import { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { BAN_REASON_MAX_LENGTH } from '@the-scroll/types';
import { failResponse, okResponse } from '../../lib/response';
import { requireRole } from '../../plugins/requireRole';
import {
	banUser,
	getUserMetrics,
	listAdminUsers,
	unbanUser,
	type ModerationResult,
} from './admin.service';

const banSchema = z.strictObject({
	reason: z.string().trim().max(BAN_REASON_MAX_LENGTH).optional(),
});

function sendResult(reply: FastifyReply, result: ModerationResult) {
	switch (result) {
		case 'ok':
			return reply.code(200).send(okResponse());
		case 'notFound':
			return reply.code(404).send(failResponse('noUser', 'User not found.'));
		case 'unchanged':
			return reply.code(409).send(failResponse('unchanged', 'The account is already so.'));
		default:
			return reply
				.code(403)
				.send(failResponse('forbidden', 'You cannot act on this account.'));
	}
}

/** Moderation of accounts. Registered under /users/admin; moderators and admins only. */
export const adminRoutes: FastifyPluginAsync = async (fastify) => {
	const guard = { preHandler: [fastify.authenticate, requireRole('ADMIN', 'MODERATOR')] };

	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.get<{ Querystring: { query?: string; banned?: string } }>(
		'/users',
		guard,
		async (request, reply) => {
			const query = request.query.query?.trim().slice(0, 64);
			const users = await listAdminUsers({
				query: query || undefined,
				banned: request.query.banned === 'true',
				// Emails are private: only admins see (and can search by) them.
				includeEmail: request.user!.roles.includes('ADMIN'),
			});

			return reply.code(200).send({ users });
		},
	);

	fastify.get('/metrics', guard, async (_request, reply) =>
		reply.code(200).send({ metrics: await getUserMetrics() }),
	);

	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.post<{ Params: { userName: string } }>(
		'/users/:userName/ban',
		guard,
		async (request, reply) => {
			const parsed = banSchema.safeParse(request.body ?? {});

			if (!parsed.success) {
				return reply.code(400).send(failResponse('invalidBan', 'The reason is invalid.'));
			}

			const { userID, roles } = request.user!;
			return sendResult(
				reply,
				await banUser({ userID, roles }, request.params.userName, parsed.data.reason),
			);
		},
	);

	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.delete<{ Params: { userName: string } }>(
		'/users/:userName/ban',
		guard,
		async (request, reply) => {
			const { userID, roles } = request.user!;
			return sendResult(reply, await unbanUser({ userID, roles }, request.params.userName));
		},
	);
};
