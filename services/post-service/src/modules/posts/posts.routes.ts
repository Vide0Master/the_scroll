import { FastifyPluginAsync } from 'fastify';
import { failResponse, okResponse } from '@the-scroll/backend-core';
import { Types } from '@the-scroll/types';
import { createPost, getFeed } from './posts.service';

export interface PostsRoutesOptions {
	userServiceUrl: string;
}

export const postsRoutes: FastifyPluginAsync<PostsRoutesOptions> = async (fastify, options) => {
	fastify.post<{
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Body: Types['api']['posts']['create']['req'];
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Reply: Types['api']['posts']['create']['res'];
	}>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
		const { content, mediaUrls } = request.body;

		if (!content && (!mediaUrls || mediaUrls.length === 0)) {
			return reply
				.code(400)
				.send(failResponse('emptyPost', 'Post must contain text content or media files.'));
		}

		const post = await createPost(request.userID!, content || '', mediaUrls || []);

		return reply.code(201).send(okResponse({ post }));
	});

	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.get<{ Querystring: { limit?: string; cursor?: string } }>(
		'/feed',
		async (request, reply) => {
			const limit = Math.min(Number(request.query.limit) || 20, 50);
			const posts = await getFeed(limit, options.userServiceUrl);

			return reply.code(200).send({ posts });
		},
	);
};
