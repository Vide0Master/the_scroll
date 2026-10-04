import { FastifyPluginAsync } from 'fastify';
import { MediaUsageError, type MediaUsageClient } from '@the-scroll/backend-core';
import { failResponse, okResponse } from '../../lib/response';
import { profileUpdateSchema } from './profile.schema';
import { updateProfile } from './profile.service';

export interface ProfileRoutesOptions {
	media: MediaUsageClient;
}

export const profileRoutes: FastifyPluginAsync<ProfileRoutesOptions> = async (fastify, options) => {
	fastify.put('/me/profile', { preHandler: [fastify.authenticate] }, async (request, reply) => {
		const parsed = profileUpdateSchema.safeParse(request.body);

		if (!parsed.success) {
			return reply
				.code(400)
				.send(failResponse('invalidProfile', 'Profile fields are missing or invalid.'));
		}

		// The target is always the session user: an `userID` in the body is not even read.
		try {
			const userData = await updateProfile(request.user!.userID, parsed.data, options.media);

			return reply.code(200).send(okResponse({ userData }));
		} catch (error) {
			if (error instanceof MediaUsageError) {
				return error.code === 'mediaNotOwned'
					? reply
							.code(403)
							.send(
								failResponse('mediaNotOwned', 'You can only use your own uploads.'),
							)
					: reply
							.code(502)
							.send(
								failResponse('mediaUnavailable', 'Media service is unavailable.'),
							);
			}

			throw error;
		}
	});
};
