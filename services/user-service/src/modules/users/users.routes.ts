import { FastifyPluginAsync } from 'fastify';
import { Types } from '@the-scroll/types';
import { getUserByUsername, getUsersByIds } from './users.service';
import { failResponse } from '../../lib/response';

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
	fastify.post<{ Body: { userIDs: string[] } }>('/by-ids', async (request, reply) => {
		const { userIDs } = request.body;

		if (!Array.isArray(userIDs) || userIDs.length === 0) {
			return reply.code(200).send({ users: [] });
		}

		const users = await getUsersByIds(userIDs);
		return reply.code(200).send({ users });
	});

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
