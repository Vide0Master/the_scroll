import type { FastifyReply, FastifyRequest } from 'fastify';
import { failResponse } from '../response';

/**
 * Route guard for services that validate sessions through user-service: lets the request pass
 * when the session user holds at least one of `roles`. Put it after `fastify.authenticate`.
 */
export function requireRole(...roles: string[]) {
	return async (request: FastifyRequest, reply: FastifyReply) => {
		if (!request.sessionUser?.roles?.some((role) => roles.includes(role))) {
			return reply
				.code(403)
				.send(failResponse('forbidden', 'You do not have access to this.'));
		}
	};
}
