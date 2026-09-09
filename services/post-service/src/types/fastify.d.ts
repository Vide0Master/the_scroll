import { FastifyReply, FastifyRequest } from 'fastify';

export interface UserSessionData {
	userID: string;
	userName: string;
	visibleName: string | null;
}

declare module 'fastify' {
	interface FastifyRequest {
		user: UserSessionData | null;
	}

	interface FastifyInstance {
		authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
	}
}
