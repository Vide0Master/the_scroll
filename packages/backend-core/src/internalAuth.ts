import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

export const INTERNAL_TOKEN_HEADER = 'x-internal-token';

function tokensMatch(given: string, expected: string): boolean {
	const a = Buffer.from(given);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Fastify `preHandler` for service-to-service routes. These routes must also stay off the public
 * proxy paths; the shared secret is the second lock. An unset token rejects everything.
 */
export function requireInternalToken(expected: string | undefined) {
	return async (request: FastifyRequest, reply: FastifyReply) => {
		const given = request.headers[INTERNAL_TOKEN_HEADER];

		if (!expected || typeof given !== 'string' || !tokensMatch(given, expected)) {
			return reply.code(401).send({
				success: false,
				errorDetails: { code: 'unauthorized', description: 'Internal token required.' },
			});
		}
	};
}
