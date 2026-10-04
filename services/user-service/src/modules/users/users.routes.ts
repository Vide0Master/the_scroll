import { FastifyPluginAsync } from 'fastify';
import { Types } from '@the-scroll/types';
import {
	getUserByUsername,
	getUsersByIds,
	getUsersByNames,
	searchUsers,
	setUserRoles,
} from './users.service';
import { failResponse } from '../../lib/response';
import { requireRole } from '../../plugins/requireRole';
import { rolesUpdateSchema } from './roles.schema';

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.get<{ Reply: Types['api']['auth']['user']['res'] }>(
		'/me',
		{ preHandler: [fastify.authenticate] },
		async (request, reply) => {
			return reply.code(200).send({
				userData: request.user!,
			});
		},
	);

	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.post<{ Body: { userIDs: string[]; activeOnly?: boolean } }>(
		'/by-ids',
		async (request, reply) => {
			const { userIDs, activeOnly } = request.body;

			if (!Array.isArray(userIDs) || userIDs.length === 0) {
				return reply.code(200).send({ users: [] });
			}

			const users = await getUsersByIds(userIDs, activeOnly === true);
			return reply.code(200).send({ users });
		},
	);

	// Used by post-service to check which @names in a post are real accounts.
	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.post<{ Body: { userNames: string[] } }>('/by-names', async (request, reply) => {
		const { userNames } = request.body;

		if (!Array.isArray(userNames) || userNames.length === 0 || userNames.length > 50) {
			return reply.code(200).send({ users: [] });
		}

		const users = await getUsersByNames(
			userNames.filter((name): name is string => typeof name === 'string'),
		);
		return reply.code(200).send({ users });
	});

	// Two path segments on purpose: `/search` alone would shadow the profile of a user named "search".

	fastify.get<{
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Params: { query: string };
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Querystring: { match?: string; limit?: string };
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Reply: Types['api']['users']['search']['res'];
	}>('/search/:query', async (request, reply) => {
		// Public, like the profiles it finds.
		const query = request.params.query.replace(/^@/, '').trim();

		if (query.length === 0 || query.length > 64) {
			return reply.code(200).send({ users: [] });
		}

		const limit = Math.min(Math.max(Number(request.query.limit) || 8, 1), 30);
		const match = request.query.match === 'contains' ? 'contains' : 'prefix';

		return reply.code(200).send({ users: await searchUsers(query, { match, limit }) });
	});

	// Two segments after /users: the account, then what is changed on it.
	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.put<{ Params: { userName: string } }>(
		'/:userName/roles',
		{ preHandler: [fastify.authenticate, requireRole('ADMIN')] },
		async (request, reply) => {
			const parsed = rolesUpdateSchema.safeParse(request.body);

			if (!parsed.success) {
				return reply.code(400).send(failResponse('invalidRoles', 'Roles are invalid.'));
			}

			// An admin cannot edit their own roles: that would let the last admin lock everyone
			// out by accident. Another admin (or `npm run role:set`) does it instead.
			if (request.params.userName === request.user!.userName) {
				return reply
					.code(403)
					.send(failResponse('ownRoles', 'You cannot change your own roles.'));
			}

			const userData = await setUserRoles(request.params.userName, parsed.data.roles);

			if (!userData) {
				return reply.code(404).send(failResponse('noUser', 'User not found.'));
			}

			return reply.code(200).send({ success: true, userData });
		},
	);

	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.get<{ Params: { userName: string }; Reply: Types['api']['auth']['user']['res'] }>(
		'/:userName',
		async (request, reply) => {
			const { userName } = request.params;
			const user = await getUserByUsername(userName);

			if (!user) {
				return reply.code(404).send(failResponse('noUser', 'User not found.'));
			}

			return reply.code(200).send({ userData: user });
		},
	);
};
