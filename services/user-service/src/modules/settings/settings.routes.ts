import { FastifyPluginAsync } from 'fastify';
import { failResponse, okResponse } from '../../lib/response';
import { DEFAULT_SETTINGS, settingsSchema } from './settings.schema';
import { getStoredSettings, saveSettings } from './settings.service';

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get('/me/settings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
		const stored = await getStoredSettings(request.user!.userID);

		return reply.code(200).send(
			okResponse({
				settings: stored ?? DEFAULT_SETTINGS,
				isStored: stored !== null,
			}),
		);
	});

	fastify.put('/me/settings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
		const parsed = settingsSchema.safeParse(request.body);

		if (!parsed.success) {
			return reply
				.code(400)
				.send(failResponse('invalidSettings', 'Settings are missing or invalid.'));
		}

		await saveSettings(request.user!.userID, parsed.data);

		return reply.code(200).send(okResponse({ settings: parsed.data }));
	});
};
