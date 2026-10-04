import { FastifyPluginAsync, FastifyReply } from 'fastify';
import { Types } from '@the-scroll/types';
import { Prisma } from '../../../prisma/generated/prisma/client';
import {
	checkAvailability,
	createPendingRegistration,
	dispatchVerification,
	resendVerification,
	getRegistrationStatus,
	confirmRegistration,
	authenticateUser,
	createSession,
} from './auth.service';
import { registerSchema, pendingIdSchema, verifySchema } from './auth.schemas';
import { failResponse, okResponse } from '../../lib/response';

function setSessionCookie(reply: FastifyReply, sessionID: string) {
	const expires = new Date();
	expires.setFullYear(expires.getFullYear() + 10);

	reply.setCookie('accessToken', sessionID, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		expires,
	});
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.post<{ Body: Types['api']['auth']['checkAvailable']['req'] }>(
		'/check',
		async (request, reply) => {
			const { email, username } = request.body;

			if (!email && !username) {
				return reply
					.code(400)
					.send(
						failResponse(
							'usernameOrEmailNotProvided',
							'No username or email was provided within request.',
						),
					);
			}

			const result = await checkAvailability(email, username);
			return reply.code(200).send(result);
		},
	);

	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.post<{ Body: Types['api']['auth']['register']['req'] }>(
		'/register',
		async (request, reply) => {
			const parsed = registerSchema.safeParse(request.body);

			if (!parsed.success) {
				return reply
					.code(400)
					.send(
						failResponse(
							'partialRequest',
							'Request has missing or invalid email, username or password.',
						),
					);
			}

			const { email, username, password, replacesID } = parsed.data;

			try {
				const pending = await createPendingRegistration(
					email,
					username,
					password,
					replacesID,
				);

				if (pending.conflict === 'blocked') {
					return reply
						.code(403)
						.send(failResponse('emailBlocked', 'This email is blocked.'));
				}

				if (pending.conflict) {
					return reply
						.code(409)
						.send(
							failResponse(
								pending.conflict === 'email' ? 'emailTaken' : 'usernameTaken',
								'User with provided data already exists.',
							),
						);
				}

				const mail = await dispatchVerification(pending.id, email, pending.token);

				return reply.code(201).send(
					okResponse({
						pendingID: pending.id,
						status: mail.ok ? ('SENT' as const) : ('FAILED' as const),
						error: mail.error,
					}),
				);
			} catch (error) {
				if (
					error instanceof Prisma.PrismaClientKnownRequestError &&
					error.code === 'P2002'
				) {
					return reply
						.code(409)
						.send(
							failResponse(
								'userCreationConflict',
								'User with provided data already exists.',
							),
						);
				}

				request.log.error(error);
				return reply
					.code(500)
					.send(failResponse('internalError', 'Internal server error occurred.'));
			}
		},
	);

	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.post<{ Body: Types['api']['auth']['resend']['req'] }>(
		'/register/resend',
		async (request, reply) => {
			const parsed = pendingIdSchema.safeParse(request.body);

			if (!parsed.success) {
				return reply.code(400).send(failResponse('malformed', 'Request missing id.'));
			}

			const result = await resendVerification(parsed.data.id);

			if (result.ok) {
				return reply.code(200).send(okResponse({ status: result.status }));
			}

			if (result.reason === 'cooldown') {
				return reply.code(429).send({
					...failResponse('resendCooldown', 'Wait before requesting another email.'),
					retryAfter: result.retryAfter,
				});
			}

			if (result.reason === 'limit') {
				return reply
					.code(429)
					.send(failResponse('resendLimit', 'Too many emails were requested.'));
			}

			return reply
				.code(404)
				.send(failResponse('notFound', 'Registration was not found or has expired.'));
		},
	);

	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.get<{ Params: Types['api']['auth']['status']['req'] }>(
		'/register/status/:id',
		async (request, reply) => {
			const parsed = pendingIdSchema.safeParse(request.params);

			if (!parsed.success) {
				return reply.code(400).send(failResponse('malformed', 'Invalid id.'));
			}

			const status = await getRegistrationStatus(parsed.data.id);

			if (!status) {
				return reply
					.code(404)
					.send(failResponse('notFound', 'Registration was not found or has expired.'));
			}

			return reply.code(200).send(okResponse(status));
		},
	);

	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.post<{ Body: Types['api']['auth']['verify']['req'] }>(
		'/verify',
		async (request, reply) => {
			const parsed = verifySchema.safeParse(request.body);

			if (!parsed.success) {
				return reply.code(400).send(failResponse('malformed', 'Request missing token.'));
			}

			try {
				const user = await confirmRegistration(parsed.data.token);

				if (!user) {
					return reply
						.code(410)
						.send(
							failResponse(
								'invalidToken',
								'The confirmation link is invalid or has expired.',
							),
						);
				}

				const session = await createSession(user.userID);
				setSessionCookie(reply, session.sessionID);

				return reply.code(200).send(okResponse());
			} catch (error) {
				if (
					error instanceof Prisma.PrismaClientKnownRequestError &&
					error.code === 'P2002'
				) {
					return reply
						.code(409)
						.send(
							failResponse(
								'userCreationConflict',
								'User with provided data already exists.',
							),
						);
				}

				request.log.error(error);
				return reply
					.code(500)
					.send(failResponse('internalError', 'Internal server error occurred.'));
			}
		},
	);

	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.post<{ Body: Types['api']['auth']['login']['req'] }>(
		'/login',
		async (request, reply) => {
			const { loginName, password } = request.body;

			if (!loginName || !password) {
				return reply
					.code(400)
					.send(failResponse('malformed', 'Request missing loginName or password.'));
			}

			const user = await authenticateUser(loginName, password);
			if (!user) {
				return reply
					.code(401)
					.send(failResponse('loginPasswordError', 'Login or password is wrong.'));
			}

			// Said only after the password matched, so it can't be used to probe for banned names.
			if (user.bannedAt) {
				return reply
					.code(403)
					.send(failResponse('accountBanned', 'This account is blocked.'));
			}

			const session = await createSession(user.userID);

			setSessionCookie(reply, session.sessionID);

			return reply.code(200).send(okResponse());
		},
	);
};
