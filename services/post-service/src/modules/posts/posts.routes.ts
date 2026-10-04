import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
	failResponse,
	okResponse,
	requireRole,
	MediaUsageError,
	type MediaUsageClient,
} from '@the-scroll/backend-core';
import { validateUserSessionViaService } from '../../lib/authValidator';
import { fetchFollowingIDs } from '../../lib/following';
import type { Notifier } from '../../lib/notifier';
import {
	BAN_REASON_MAX_LENGTH,
	POST_CONTENT_MAX_LENGTH,
	POST_MEDIA_MAX_FILES,
	normalizeHashtag,
	SEARCH_QUERY_MAX_LENGTH,
	Types,
} from '@the-scroll/types';
import {
	ParentDeletedError,
	ParentNotFoundError,
	createPost,
	deletePost,
	cursorFilter,
	getFeed,
	getModerationPosts,
	getPostByID,
	getPostsByAuthor,
	getPostsByHashtag,
	getReplies,
	presentPost,
	removePostAsModerator,
	searchPosts,
	searchTags,
	updatePost,
} from './posts.service';
import {
	getPostMetrics,
	getTrends,
	likePost,
	recordView,
	resolveTrendingUsers,
	unlikePost,
} from './popularity';
import { parseSearchQuery } from './search';

export interface PostsRoutesOptions {
	userServiceUrl: string;
	media: MediaUsageClient;
	notifier: Notifier;
}

// Media-service refused the files or is down: the write did not happen.
function sendMediaError(reply: FastifyReply, error: unknown) {
	if (error instanceof MediaUsageError) {
		return error.code === 'mediaNotOwned'
			? reply
					.code(403)
					.send(failResponse('mediaNotOwned', 'You can only attach your own uploads.'))
			: reply
					.code(502)
					.send(failResponse('mediaUnavailable', 'Media service is unavailable.'));
	}

	throw error;
}

const MAX_MEDIA_URL_LENGTH = 2048;

// Shared by create and update: content or media required, content within the length limit, media
// an array of reasonably-sized URL strings within the per-post file count. Returns an error code
// for `failResponse`, or null when the input is valid.
function validatePostInput(content: unknown, mediaUrls: unknown): string | null {
	if (typeof content !== 'string') {
		return 'malformed';
	}

	const media = mediaUrls ?? [];

	if (!Array.isArray(media)) {
		return 'malformed';
	}

	if (!content.trim() && media.length === 0) {
		return 'emptyPost';
	}

	if (content.length > POST_CONTENT_MAX_LENGTH) {
		return 'contentTooLong';
	}

	if (media.length > POST_MEDIA_MAX_FILES) {
		return 'tooManyFiles';
	}

	if (
		!media.every(
			(url) =>
				typeof url === 'string' && url.length > 0 && url.length <= MAX_MEDIA_URL_LENGTH,
		)
	) {
		return 'invalidMedia';
	}

	return null;
}

function sendValidationError(reply: FastifyReply, code: string) {
	const messages: Record<string, string> = {
		malformed: 'Request has an invalid content or mediaUrls field.',
		emptyPost: 'Post must contain text content or media files.',
		contentTooLong: `Post content must be at most ${POST_CONTENT_MAX_LENGTH} characters.`,
		tooManyFiles: `A post can have at most ${POST_MEDIA_MAX_FILES} media files.`,
		invalidMedia: 'Each media URL must be a non-empty string.',
	};

	return reply.code(400).send(failResponse(code, messages[code] ?? 'Invalid request.'));
}

export const postsRoutes: FastifyPluginAsync<PostsRoutesOptions> = async (fastify, options) => {
	// Listings are public, but a signed-in viewer also learns which posts they liked. A missing or
	// stale session just means "nobody": it must not turn a public read into a 401.
	const viewerOf = async (request: FastifyRequest): Promise<string | null> => {
		const token = request.cookies.accessToken;

		if (!token) {
			return null;
		}

		const user = await validateUserSessionViaService(token, options.userServiceUrl);
		return user?.userID ?? null;
	};

	fastify.post<{
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Body: Types['api']['posts']['create']['req'];
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Reply: Types['api']['posts']['create']['res'];
	}>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
		const { content, mediaUrls, parentPostID } = request.body;

		const validationError = validatePostInput(content, mediaUrls);
		if (validationError) {
			return sendValidationError(reply, validationError);
		}

		if (
			parentPostID !== undefined &&
			(typeof parentPostID !== 'string' ||
				parentPostID.length === 0 ||
				parentPostID.length > 64)
		) {
			return reply.code(400).send(failResponse('malformedPostID', 'Post id is invalid.'));
		}

		try {
			const post = await createPost(
				request.userID!,
				content || '',
				mediaUrls || [],
				options.media,
				parentPostID,
				options.userServiceUrl,
				options.notifier,
			);

			return reply.code(201).send(
				okResponse({
					post: await presentPost(post, options.userServiceUrl, true, request.userID),
				}),
			);
		} catch (error) {
			if (error instanceof ParentNotFoundError) {
				return reply
					.code(404)
					.send(failResponse('parentNotFound', 'The post you reply to does not exist.'));
			}

			if (error instanceof ParentDeletedError) {
				return reply
					.code(409)
					.send(failResponse('parentDeleted', 'The post you reply to was deleted.'));
			}

			return sendMediaError(reply, error);
		}
	});

	fastify.patch<{
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Params: { postID: string };
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Body: Types['api']['posts']['update']['req'];
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Reply: Types['api']['posts']['update']['res'];
	}>('/:postID', { preHandler: [fastify.authenticate] }, async (request, reply) => {
		const { postID } = request.params;
		const { content, mediaUrls } = request.body;

		if (postID.length === 0 || postID.length > 64) {
			return reply.code(400).send(failResponse('malformedPostID', 'Post id is invalid.'));
		}

		const validationError = validatePostInput(content, mediaUrls);
		if (validationError) {
			return sendValidationError(reply, validationError);
		}

		let post;

		try {
			post = await updatePost(
				postID,
				request.userID!,
				content,
				mediaUrls || [],
				options.media,
				options.userServiceUrl,
			);
		} catch (error) {
			return sendMediaError(reply, error);
		}

		if (!post) {
			// Doesn't distinguish "no such post" from "not yours": either way there is nothing
			// this caller may edit.
			return reply
				.code(404)
				.send(failResponse('postNotFound', 'Post not found or not editable by you.'));
		}

		return reply.code(200).send(
			okResponse({
				post: await presentPost(post, options.userServiceUrl, false, request.userID),
			}),
		);
	});

	fastify.delete<{
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Params: { postID: string };
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Reply: Types['api']['posts']['remove']['res'];
	}>('/:postID', { preHandler: [fastify.authenticate] }, async (request, reply) => {
		const { postID } = request.params;

		if (postID.length === 0 || postID.length > 64) {
			return reply.code(400).send(failResponse('malformedPostID', 'Post id is invalid.'));
		}

		try {
			const isDeleted = await deletePost(postID, request.userID!, options.media);

			if (!isDeleted) {
				return reply
					.code(404)
					.send(failResponse('postNotFound', 'Post not found or not deletable by you.'));
			}

			return reply.code(200).send(okResponse({}));
		} catch (error) {
			return sendMediaError(reply, error);
		}
	});

	// Moderators and admins only. Different path from the author's own DELETE on purpose: this one
	// is allowed on posts that are not yours and records who did it.
	fastify.delete<{
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Params: { postID: string };
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Body: { reason?: string } | undefined;
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Reply: Types['api']['posts']['moderate']['res'];
	}>(
		'/:postID/moderation',
		{ preHandler: [fastify.authenticate, requireRole('ADMIN', 'MODERATOR')] },
		async (request, reply) => {
			const { postID } = request.params;
			const reason = request.body?.reason;

			if (
				postID.length === 0 ||
				postID.length > 64 ||
				(reason !== undefined &&
					(typeof reason !== 'string' || reason.length > BAN_REASON_MAX_LENGTH))
			) {
				return reply
					.code(400)
					.send(failResponse('malformedRequest', 'Request is invalid.'));
			}

			try {
				const isRemoved = await removePostAsModerator(
					postID,
					request.userID!,
					reason?.trim(),
					options.media,
				);

				if (!isRemoved) {
					return reply
						.code(404)
						.send(failResponse('postNotFound', 'Post not found or already deleted.'));
				}

				return reply.code(200).send(okResponse({}));
			} catch (error) {
				return sendMediaError(reply, error);
			}
		},
	);

	// Two path segments, so it cannot be taken for a post id.
	fastify.get<{
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Querystring: { limit?: string };
	}>(
		'/moderation/list',
		{ preHandler: [fastify.authenticate, requireRole('ADMIN', 'MODERATOR')] },
		async (request, reply) => {
			const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 100);
			const posts = await getModerationPosts(limit, options.userServiceUrl, request.userID);

			return reply.code(200).send({ posts });
		},
	);

	fastify.get<{
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Params: { postID: string };
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Reply: Types['api']['posts']['getOne']['res'];
	}>('/:postID', async (request, reply) => {
		const { postID } = request.params;

		if (postID.length === 0 || postID.length > 64) {
			return reply.code(400).send(failResponse('malformedPostID', 'Post id is invalid.'));
		}

		const thread = await getPostByID(postID, options.userServiceUrl, await viewerOf(request));

		if (!thread) {
			return reply.code(404).send(failResponse('postNotFound', 'Post not found.'));
		}

		return reply.code(200).send(okResponse(thread));
	});

	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.get<{ Params: { postID: string }; Querystring: { limit?: string; cursor?: string } }>(
		'/:postID/replies',
		async (request, reply) => {
			const { postID } = request.params;

			if (postID.length === 0 || postID.length > 64) {
				return reply.code(400).send(failResponse('malformedPostID', 'Post id is invalid.'));
			}

			const limit = Math.min(Math.max(Number(request.query.limit) || 30, 1), 50);
			const after = request.query.cursor
				? cursorFilter(request.query.cursor, 'newer')
				: undefined;

			if (after === null) {
				return reply
					.code(400)
					.send(failResponse('invalidCursor', 'The cursor is not valid.'));
			}

			const page = await getReplies(
				postID,
				limit,
				options.userServiceUrl,
				await viewerOf(request),
				after,
			);

			return reply.code(200).send(page);
		},
	);

	// Two path segments (or a fixed word), so none of these can be taken for a post id.
	fastify.get(
		'/admin/metrics',
		{ preHandler: [fastify.authenticate, requireRole('ADMIN', 'MODERATOR')] },
		async (_request, reply) => reply.code(200).send({ metrics: await getPostMetrics() }),
	);

	// Hashtags and authors that got the most likes and replies from others in the last days.
	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.get<{ Querystring: { limit?: string } }>('/trending', async (request, reply) => {
		const limit = Math.min(Math.max(Number(request.query.limit) || 5, 1), 20);
		const trends = await getTrends(limit);
		const users = await resolveTrendingUsers(trends.users, options.userServiceUrl);

		return reply.code(200).send({ tags: trends.tags, users });
	});

	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.put<{ Params: { postID: string } }>(
		'/:postID/like',
		{ preHandler: [fastify.authenticate] },
		async (request, reply) => {
			const { postID } = request.params;

			if (postID.length === 0 || postID.length > 64) {
				return reply.code(400).send(failResponse('malformedPostID', 'Post id is invalid.'));
			}

			const likeCount = await likePost(postID, request.userID!, options.notifier);

			return likeCount === null
				? reply.code(404).send(failResponse('postNotFound', 'Post not found.'))
				: reply.code(200).send(okResponse({ likeCount }));
		},
	);

	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.delete<{ Params: { postID: string } }>(
		'/:postID/like',
		{ preHandler: [fastify.authenticate] },
		async (request, reply) => {
			const { postID } = request.params;

			if (postID.length === 0 || postID.length > 64) {
				return reply.code(400).send(failResponse('malformedPostID', 'Post id is invalid.'));
			}

			const likeCount = await unlikePost(postID, request.userID!);

			return likeCount === null
				? reply.code(404).send(failResponse('postNotFound', 'Post not found.'))
				: reply.code(200).send(okResponse({ likeCount }));
		},
	);

	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.post<{ Params: { postID: string } }>(
		'/:postID/view',
		{ preHandler: [fastify.authenticate] },
		async (request, reply) => {
			const { postID } = request.params;

			if (postID.length === 0 || postID.length > 64) {
				return reply.code(400).send(failResponse('malformedPostID', 'Post id is invalid.'));
			}

			return (await recordView(postID, request.userID!))
				? reply.code(200).send(okResponse({}))
				: reply.code(404).send(failResponse('postNotFound', 'Post not found.'));
		},
	);

	// Full-text-ish search over the words of the query (see parseSearchQuery). Public, like the feed.
	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.get<{ Querystring: { q?: string; limit?: string; cursor?: string } }>(
		'/search',
		async (request, reply) => {
			const search = parseSearchQuery((request.query.q ?? '').trim());

			if (!search) {
				return reply
					.code(400)
					.send(failResponse('invalidQuery', 'Type at least one word or #hashtag.'));
			}

			const limit = Math.min(Math.max(Number(request.query.limit) || 30, 1), 50);
			const after = request.query.cursor ? cursorFilter(request.query.cursor) : undefined;

			if (after === null) {
				return reply
					.code(400)
					.send(failResponse('invalidCursor', 'The cursor is not valid.'));
			}

			const page = await searchPosts(
				search,
				limit,
				options.userServiceUrl,
				await viewerOf(request),
				after,
			);

			return reply.code(200).send(page);
		},
	);

	// Hashtag hints and the hashtag list of the search page.
	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.get<{ Querystring: { q?: string; match?: string; limit?: string } }>(
		'/tags',
		async (request, reply) => {
			const q = normalizeHashtag((request.query.q ?? '').trim());

			if (!q || q.length > SEARCH_QUERY_MAX_LENGTH) {
				return reply.code(200).send({ tags: [] });
			}

			const limit = Math.min(Math.max(Number(request.query.limit) || 8, 1), 30);
			const match = request.query.match === 'contains' ? 'contains' : 'prefix';

			return reply.code(200).send({ tags: await searchTags(q, match, limit) });
		},
	);

	// Two path segments, so it cannot be mistaken for a post id.
	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.get<{ Params: { tag: string }; Querystring: { limit?: string; cursor?: string } }>(
		'/hashtag/:tag',
		async (request, reply) => {
			const tag = normalizeHashtag(request.params.tag);

			if (!tag) {
				return reply.code(400).send(failResponse('invalidTag', 'Hashtag is invalid.'));
			}

			const limit = Math.min(Math.max(Number(request.query.limit) || 30, 1), 50);
			const after = request.query.cursor ? cursorFilter(request.query.cursor) : undefined;

			if (after === null) {
				return reply
					.code(400)
					.send(failResponse('invalidCursor', 'The cursor is not valid.'));
			}

			const page = await getPostsByHashtag(
				tag,
				limit,
				options.userServiceUrl,
				await viewerOf(request),
				after,
			);

			return reply.code(200).send(page);
		},
	);

	// eslint-disable-next-line @typescript-eslint/naming-convention
	fastify.get<{ Querystring: { limit?: string; cursor?: string; scope?: string } }>(
		'/feed',
		async (request, reply) => {
			const limit = Math.min(Math.max(Number(request.query.limit) || 20, 1), 50);
			const after = request.query.cursor ? cursorFilter(request.query.cursor) : undefined;

			if (after === null) {
				return reply
					.code(400)
					.send(failResponse('invalidCursor', 'The cursor is not valid.'));
			}

			let authorIDs: string[] | undefined;

			if (request.query.scope === 'following') {
				await fastify.authenticate(request, reply);

				if (reply.sent) {
					return;
				}

				const ids = await fetchFollowingIDs(
					options.userServiceUrl,
					request.cookies.accessToken!,
				);

				if (!ids) {
					return reply
						.code(502)
						.send(failResponse('followsUnavailable', 'Could not load your follows.'));
				}

				authorIDs = ids;
			}

			const page = await getFeed(
				limit,
				options.userServiceUrl,
				authorIDs,
				request.userID ?? (await viewerOf(request)),
				after,
			);

			return reply.code(200).send(page);
		},
	);

	fastify.get<{
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Params: { authorID: string };
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Querystring: { limit?: string; kind?: string; cursor?: string };
	}>('/user/:authorID', async (request, reply) => {
		const { authorID } = request.params;

		if (authorID.length === 0 || authorID.length > 64) {
			return reply
				.code(400)
				.send(failResponse('malformedAuthorID', 'Author id is missing or too long.'));
		}

		const { kind = 'posts' } = request.query;

		if (kind !== 'posts' && kind !== 'replies') {
			return reply
				.code(400)
				.send(failResponse('invalidKind', 'kind must be posts or replies.'));
		}

		const limit = Math.min(Math.max(Number(request.query.limit) || 30, 1), 50);
		const after = request.query.cursor ? cursorFilter(request.query.cursor) : undefined;

		if (after === null) {
			return reply.code(400).send(failResponse('invalidCursor', 'The cursor is not valid.'));
		}

		const page = await getPostsByAuthor(
			authorID,
			kind,
			limit,
			options.userServiceUrl,
			await viewerOf(request),
			after,
		);

		return reply.code(200).send(page);
	});
};
