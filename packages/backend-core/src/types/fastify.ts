import { FastifyReply, FastifyRequest } from 'fastify';

export interface BaseSessionUser {
	userID: string;
	userName?: string;
	visibleName?: string | null;
	createdAt?: Date;
}

declare module 'fastify' {
	interface FastifyRequest {
		userID: string | null;
		sessionUser: BaseSessionUser | null;
	}

	interface FastifyInstance {
		authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
	}
}
