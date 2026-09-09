import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { getSessionUser } from '../modules/users/users.service';
import { failResponse } from '../lib/response';

const authPlugin: FastifyPluginAsync = async (fastify) => {
	fastify.decorateRequest('user', null);

	fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
		const sessionToken = request.cookies.accessToken;

		if (!sessionToken) {
			return reply.code(401).send(failResponse('unauthorized', 'Session token is missing.'));
		}

		const user = await getSessionUser(sessionToken);

		if (!user) {
			return reply
				.code(401)
				.send(failResponse('invalidSession', 'Invalid or expired user session.'));
		}

		request.user = user;
	});
};

export default fp(authPlugin);
