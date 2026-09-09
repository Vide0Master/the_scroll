import { FastifyPluginAsync } from 'fastify';
import { Types } from '@the-scroll/types';
import { Prisma } from '../../../prisma/generated/prisma/client';
import { checkAvailability, createUser, authenticateUser, createSession } from './auth.service';
import { failResponse, okResponse } from '../../lib/response';

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
			const { email, username, password } = request.body;

			if (!email || !username || !password) {
				return reply
					.code(400)
					.send(
						failResponse(
							'partialRequest',
							'Request missing email, username or password.',
						),
					);
			}

			try {
				await createUser(email, username, password);
				return reply.code(201).send(okResponse());
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

			const session = await createSession(user.userID);

			const expires = new Date();
			expires.setFullYear(expires.getFullYear() + 10);

			reply.setCookie('accessToken', session.sessionID, {
				path: '/',
				httpOnly: true,
				sameSite: 'strict',
				expires,
			});

			return reply.code(200).send(okResponse());
		},
	);
};
