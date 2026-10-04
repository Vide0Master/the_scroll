import type { FastifyReply, FastifyRequest } from 'fastify';
import type { UserRole } from '@the-scroll/types';
import { failResponse } from '../lib/response';

/**
 * Route guard: allows the request when the session user holds at least one of `roles`. Use it
 * after `fastify.authenticate`, which is what puts the user (with their roles) on the request.
 */
export function requireRole(...roles: UserRole[]) {
	return async (request: FastifyRequest, reply: FastifyReply) => {
		if (!request.user?.roles.some((role) => roles.includes(role))) {
			return reply
				.code(403)
				.send(failResponse('forbidden', 'You do not have access to this.'));
		}
	};
}
