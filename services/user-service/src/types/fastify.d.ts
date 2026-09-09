import { FastifyReply } from 'fastify';

export interface UserSessionData {
	userID: string;
	userName: string;
	visibleName: string | null;
	createdAt: Date;
}

declare module 'fastify' {
	interface FastifyRequest {
		user: UserSessionData | null;
	}

	interface FastifyInstance {
		authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
	}
}
