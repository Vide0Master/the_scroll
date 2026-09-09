import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { failResponse } from '../response';
import { BaseSessionUser } from '../types/fastify';

export interface AuthPluginOptions {
	validateSession: (sessionID: string) => Promise<BaseSessionUser | null>;
}

export function createAuthPlugin(options: AuthPluginOptions): FastifyPluginAsync {
	const plugin: FastifyPluginAsync = async (fastify) => {
		fastify.decorateRequest('userID', null);
		fastify.decorateRequest('sessionUser', null);

		fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
			const sessionToken = request.cookies.accessToken;

			if (!sessionToken) {
				return reply
					.code(401)
					.send(failResponse('unauthorized', 'Session token is missing.'));
			}

			const user = await options.validateSession(sessionToken);

			if (!user) {
				return reply
					.code(401)
					.send(failResponse('invalidSession', 'Invalid or expired session.'));
			}

			request.userID = user.userID;
			request.sessionUser = user;
		});
	};

	return fp(plugin);
}
