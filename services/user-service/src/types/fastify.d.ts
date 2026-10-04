import { FastifyReply } from 'fastify';

import type { UserProfile } from '@the-scroll/types';

export type UserSessionData = UserProfile;

declare module 'fastify' {
	interface FastifyRequest {
		user: UserSessionData | null;
	}

	interface FastifyInstance {
		authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
	}
}
