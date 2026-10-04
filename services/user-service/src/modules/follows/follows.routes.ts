import { FastifyPluginAsync, FastifyReply } from 'fastify';
import { failResponse, okResponse } from '../../lib/response';
import { getSessionUser } from '../users/users.service';
import { followUser, getFollowStats, getFollowingIDs, unfollowUser } from './follows.service';
import type { FollowResult } from './follows.service';

function sendResult(reply: FastifyReply, result: FollowResult) {
	if (result === 'notFound') {
		return reply.code(404).send(failResponse('noUser', 'User not found.'));
	}

	if (result === 'self') {
		return reply.code(400).send(failResponse('self', 'You cannot follow yourself.'));
	}

	return reply.code(200).send(okResponse());
}

/** Following. Registered under /users. */
export const followsRoutes: FastifyPluginAsync = async (fastify) => {
	const guard = { preHandler: [fastify.authenticate] };

	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.put<{ Params: { userName: string } }>(
		'/:userName/follow',
		guard,
		async (request, reply) =>
			sendResult(reply, await followUser(request.user!.userID, request.params.userName)),
	);

	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.delete<{ Params: { userName: string } }>(
		'/:userName/follow',
		guard,
		async (request, reply) =>
			sendResult(reply, await unfollowUser(request.user!.userID, request.params.userName)),
	);

	// Public, like the profile itself; a signed-in viewer also learns whether they follow.
	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.get<{ Params: { userName: string } }>(
		'/:userName/follow-stats',
		async (request, reply) => {
			const token = request.cookies.accessToken;
			const viewer = token ? await getSessionUser(token) : null;
			const stats = await getFollowStats(request.params.userName, viewer?.userID);

			if (!stats) {
				return reply.code(404).send(failResponse('noUser', 'User not found.'));
			}

			return reply.code(200).send(okResponse({ stats }));
		},
	);

	fastify.get('/me/following-ids', guard, async (request, reply) => {
		return reply.code(200).send({ userIDs: await getFollowingIDs(request.user!.userID) });
	});
};
