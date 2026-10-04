import { escapeLike, type MediaUsageClient } from '@the-scroll/backend-core';
import {
	extractHashtags,
	extractMentions,
	type AuthorProfile,
	type FeedPost,
	type SearchTag,
} from '@the-scroll/types';
import type { Notifier, PostNotification } from '../../lib/notifier';
import { prisma } from '../../lib/prisma';
import type { ParsedSearch } from './search';

export class ParentNotFoundError extends Error {}
export class ParentDeletedError extends Error {}

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface ResolvedMention {
	userID: string;
	userName: string;
}

// Which @names of a text belong to real accounts, asked of user-service. Never throws: when it
// is unreachable the post is still saved, its @names just stay plain text.
async function resolveMentions(
	content: string,
	userServiceUrl?: string,
): Promise<ResolvedMention[]> {
	const names = extractMentions(content);

	if (!userServiceUrl || names.length === 0) {
		return [];
	}

	try {
		const response = await fetch(`${userServiceUrl}/users/by-names`, {
			method: 'POST',
			headers: {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ userNames: names }),
		});

		if (response.ok) {
			const data = (await response.json()) as { users?: AuthorProfile[] };

			if (Array.isArray(data.users)) {
				return data.users.map(({ userID, userName }) => ({ userID, userName }));
			}
		}
	} catch (error) {
		console.error('Failed to resolve mentions:', error);
	}

	return [];
}

// Rebuilds the hashtag and mention index of one post from its text; also used with an empty
// text to clear it.
async function indexTextEntities(
	tx: Transaction,
	postID: string,
	content: string,
	mentions: ResolvedMention[],
) {
	await Promise.all([
		tx.postTag.deleteMany({ where: { postID } }),
		tx.postMention.deleteMany({ where: { postID } }),
	]);

	const tags = extractHashtags(content);

	await Promise.all([
		tags.length > 0
			? tx.postTag.createMany({ data: tags.map((tag) => ({ postID, tag })) })
			: undefined,
		mentions.length > 0
			? tx.postMention.createMany({
					data: mentions.map(({ userID, userName }) => ({ postID, userID, userName })),
				})
			: undefined,
	]);
}

// Media usage is reported to media-service inside the same transaction as the write: if it
// refuses (someone else's file) or is unreachable the post isn't saved either, so no post can
// end up pointing at a file that media-service would later sweep as unused.
export async function createPost(
	authorID: string,
	content: string,
	mediaUrls: string[],
	media: MediaUsageClient,
	parentPostID?: string,
	userServiceUrl?: string,
	notifier?: Notifier,
) {
	const mentions = await resolveMentions(content, userServiceUrl);
	let parentAuthorID: string | null = null;

	const post = await prisma.$transaction(async (tx) => {
		if (parentPostID) {
			const parent = await tx.post.findUnique({
				where: { postID: parentPostID },
				select: { postID: true, authorID: true, deletedAt: true },
			});

			if (!parent) {
				throw new ParentNotFoundError();
			}

			if (parent.deletedAt) {
				throw new ParentDeletedError();
			}

			parentAuthorID = parent.authorID;
		}

		const post = await tx.post.create({
			data: {
				authorID,
				content,
				media: mediaUrls,
				parentPostID: parentPostID ?? null,
			},
		});

		await indexTextEntities(tx, post.postID, content, mentions);

		if (mediaUrls.length > 0) {
			await media.sync({
				ownerID: authorID,
				usages: [{ kind: 'post', refID: post.postID, urls: mediaUrls }],
			});
		}

		return post;
	});

	// Only once the post is saved: the author of the post that was answered hears about the reply,
	// and each mentioned account about the mention (not twice, and never the author themselves).
	const notifications: PostNotification[] = [];

	if (parentAuthorID && parentAuthorID !== authorID) {
		notifications.push({
			recipientID: parentAuthorID,
			actorID: authorID,
			type: 'REPLY',
			postID: post.postID,
		});
	}

	for (const { userID } of mentions) {
		if (userID !== authorID && userID !== parentAuthorID) {
			notifications.push({
				recipientID: userID,
				actorID: authorID,
				type: 'MENTION',
				postID: post.postID,
			});
		}
	}

	// Not awaited: the response must not wait for user-service.
	void notifier?.send(notifications);

	return post;
}

// Shared by getFeed and getPostByID: ask user-service for the profile of each author id. Never
// throws — a resolution failure just means posts come back with author: null, same as before
// this existed.
async function resolveAuthors(
	authorIDs: string[],
	userServiceUrl?: string,
): Promise<Map<string, AuthorProfile>> {
	if (!userServiceUrl || authorIDs.length === 0) {
		return new Map();
	}

	try {
		const response = await fetch(`${userServiceUrl}/users/by-ids`, {
			method: 'POST',
			headers: {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ userIDs: authorIDs }),
		});

		if (response.ok) {
			const data = (await response.json()) as { users: AuthorProfile[] };
			if (data && Array.isArray(data.users)) {
				return new Map(data.users.map((user) => [user.userID, user]));
			}
		}
	} catch (error) {
		console.error('Failed to resolve author details:', error);
	}

	return new Map();
}

interface PostRow {
	postID: string;
	authorID: string;
	content: string;
	media: string[];
	parentPostID: string | null;
	deletedAt: Date | null;
	removedByID: string | null;
	removalReason?: string | null;
	createdAt: Date;
}

const MAX_THREAD_DEPTH = 20;

/**
 * Turns database rows into what clients get: reply counts, the "replying to" context and, when
 * `withAuthors` is set, each author's profile (listings that already know the author skip it).
 * One query per kind of extra data for the whole list, never one per post.
 */
async function decoratePosts(
	posts: PostRow[],
	options: { withAuthors: boolean; userServiceUrl?: string; viewerID?: string | null },
): Promise<FeedPost[]> {
	if (posts.length === 0) {
		return [];
	}

	const parentIDs = [
		...new Set(posts.flatMap((post) => (post.parentPostID ? [post.parentPostID] : []))),
	];

	const postIDs = posts.map((post) => post.postID);

	const [counts, parents, mentionRows, likeRows, viewRows, myLikes] = await Promise.all([
		prisma.post.groupBy({
			by: ['parentPostID'],
			where: { parentPostID: { in: posts.map((post) => post.postID) } },
			// eslint-disable-next-line @typescript-eslint/naming-convention
			_count: { _all: true },
		}),
		parentIDs.length
			? prisma.post.findMany({
					where: { postID: { in: parentIDs } },
					select: { postID: true, authorID: true, deletedAt: true },
				})
			: [],
		prisma.postMention.findMany({
			where: { postID: { in: posts.map((post) => post.postID) } },
			select: { postID: true, userName: true },
		}),
		prisma.postLike.groupBy({
			by: ['postID'],
			where: { postID: { in: postIDs } },
			// eslint-disable-next-line @typescript-eslint/naming-convention
			_count: { postID: true },
		}),
		prisma.postView.groupBy({
			by: ['postID'],
			where: { postID: { in: postIDs } },
			// eslint-disable-next-line @typescript-eslint/naming-convention
			_count: { postID: true },
		}),
		options.viewerID
			? prisma.postLike.findMany({
					where: { postID: { in: postIDs }, userID: options.viewerID },
					select: { postID: true },
				})
			: [],
	]);

	const likeCounts = new Map(likeRows.map((row) => [row.postID, row._count.postID]));
	const viewCounts = new Map(viewRows.map((row) => [row.postID, row._count.postID]));
	const likedByViewer = new Set(myLikes.map((row) => row.postID));

	const mentionsByPost = new Map<string, string[]>();
	for (const { postID, userName } of mentionRows) {
		mentionsByPost.set(postID, [...(mentionsByPost.get(postID) ?? []), userName]);
	}

	const replyCounts = new Map(counts.map((row) => [row.parentPostID, row._count._all]));
	const parentByID = new Map(parents.map((parent) => [parent.postID, parent]));
	const parentAuthorByPost = new Map(
		parents
			.filter((parent) => !parent.deletedAt)
			.map((parent) => [parent.postID, parent.authorID]),
	);
	const authorIDs = new Set([
		...parentAuthorByPost.values(),
		...(options.withAuthors
			? posts.filter((post) => !post.deletedAt).map((post) => post.authorID)
			: []),
	]);
	const authors = await resolveAuthors([...authorIDs], options.userServiceUrl);

	return posts.map((post) => {
		const parentAuthorID = post.parentPostID
			? parentAuthorByPost.get(post.parentPostID)
			: undefined;

		const { deletedAt, removedByID, removalReason, ...fields } = post;
		// The reason is for the moderation record only; it must not reach clients.
		void removalReason;
		const isDeleted = deletedAt !== null;

		return {
			...fields,
			// A deleted post does not disclose who wrote it.
			authorID: isDeleted ? '' : post.authorID,
			isDeleted,
			removedByModerator: isDeleted && removedByID !== null,
			createdAt: post.createdAt.toISOString(),
			author: options.withAuthors && !isDeleted ? authors.get(post.authorID) || null : null,
			replyCount: replyCounts.get(post.postID) ?? 0,
			mentions: mentionsByPost.get(post.postID) ?? [],
			likeCount: isDeleted ? 0 : (likeCounts.get(post.postID) ?? 0),
			likedByMe: !isDeleted && likedByViewer.has(post.postID),
			viewCount: isDeleted ? 0 : (viewCounts.get(post.postID) ?? 0),
			replyTo: post.parentPostID
				? {
						postID: post.parentPostID,
						isDeleted: parentByID.get(post.parentPostID)?.deletedAt != null,
						author: parentAuthorID ? authors.get(parentAuthorID) || null : null,
					}
				: null,
		};
	});
}

/** One post as clients get it (also used to answer create and edit). */
export async function presentPost(
	post: PostRow,
	userServiceUrl?: string,
	withAuthor = true,
	viewerID?: string | null,
) {
	const [presented] = await decoratePosts([post], {
		withAuthors: withAuthor,
		userServiceUrl,
		viewerID,
	});
	return presented;
}

// Replies are posts, so they appear in the feed too; `replyTo` tells the client which is which.
// Deleted posts are left out of listings and only show as a placeholder inside a thread.
/**
 * Keyset paging over (createdAt, postID), newest first. The cursor is opaque to clients; it is
 * validated here because it comes from the query string.
 */
export function encodeCursor(post: { createdAt: Date; postID: string }): string {
	return Buffer.from(`${post.createdAt.toISOString()}|${post.postID}`).toString('base64url');
}

const CURSOR_PATTERN = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\|([0-9a-f-]{36})$/;

/**
 * The rows strictly after the cursor in list order (`older` for newest-first lists, `newer` for
 * oldest-first ones such as replies); `null` when the cursor is malformed.
 */
export function cursorFilter(cursor: string, direction: 'older' | 'newer' = 'older') {
	const match = CURSOR_PATTERN.exec(Buffer.from(cursor, 'base64url').toString());
	const at = match ? new Date(match[1]) : null;

	if (!match || !at || Number.isNaN(at.getTime())) {
		return null;
	}

	const beyond = <T>(value: T) => (direction === 'older' ? { lt: value } : { gt: value });

	return {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		OR: [{ createdAt: beyond(at) }, { createdAt: at, postID: beyond(match[2]) }],
	};
}

// One row more than asked for tells whether another page exists.
async function pageOf(
	rows: PostRow[],
	limit: number,
	decorate: (page: PostRow[]) => Promise<FeedPost[]>,
) {
	const page = rows.slice(0, limit);

	return {
		posts: await decorate(page),
		nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]) : undefined,
	};
}

export async function getFeed(
	limit: number = 20,
	userServiceUrl?: string,
	authorIDs?: string[],
	viewerID?: string | null,
	after?: ReturnType<typeof cursorFilter>,
) {
	const rows = await prisma.post.findMany({
		where: {
			deletedAt: null,
			...(authorIDs ? { authorID: { in: authorIDs } } : {}),
			...(after ?? {}),
		},
		take: limit + 1,
		orderBy: [{ createdAt: 'desc' }, { postID: 'desc' }],
	});

	return pageOf(rows, limit, (page) =>
		decoratePosts(page, { withAuthors: true, userServiceUrl, viewerID }),
	);
}

// Public: anyone can view a single post (matches the feed and per-author listing, both public).
// `ancestors` is the chain of posts it answers, the first post of the thread first.
export async function getPostByID(
	postID: string,
	userServiceUrl?: string,
	viewerID?: string | null,
) {
	const post = await prisma.post.findUnique({ where: { postID } });

	if (!post) {
		return null;
	}

	const chain: PostRow[] = [];
	let nextID = post.parentPostID;

	// Bounded: a thread deeper than this shows only its nearest ancestors.
	while (nextID && chain.length < MAX_THREAD_DEPTH) {
		const ancestor = await prisma.post.findUnique({ where: { postID: nextID } });

		if (!ancestor) {
			break;
		}

		chain.unshift(ancestor);
		nextID = ancestor.parentPostID;
	}

	const [presented, ancestors] = await Promise.all([
		presentPost(post, userServiceUrl, true, viewerID),
		decoratePosts(chain, { withAuthors: true, userServiceUrl, viewerID }),
	]);

	return { post: presented, ancestors };
}

// Direct replies, oldest first so a conversation reads top to bottom.
export async function getReplies(
	postID: string,
	limit: number = 30,
	userServiceUrl?: string,
	viewerID?: string | null,
	after?: ReturnType<typeof cursorFilter>,
) {
	const rows = await prisma.post.findMany({
		where: { parentPostID: postID, ...(after ?? {}) },
		take: limit + 1,
		orderBy: [{ createdAt: 'asc' }, { postID: 'asc' }],
	});

	return pageOf(rows, limit, (page) =>
		decoratePosts(page, { withAuthors: true, userServiceUrl, viewerID }),
	);
}

// Ownership is enforced by the where clause itself: a mismatched authorID matches nothing, so
// the caller can't tell "not found" from "not yours" apart, and there's no separate fetch-then-
// check race window. Returns null for either case.
export async function updatePost(
	postID: string,
	authorID: string,
	content: string,
	mediaUrls: string[],
	media: MediaUsageClient,
	userServiceUrl?: string,
) {
	const mentions = await resolveMentions(content, userServiceUrl);

	const isUpdated = await prisma.$transaction(async (tx) => {
		const result = await tx.post.updateMany({
			where: { postID, authorID, deletedAt: null },
			data: { content, media: mediaUrls },
		});

		if (result.count === 0) {
			return false;
		}

		await indexTextEntities(tx, postID, content, mentions);

		// Always synced, even with no media: that is what releases files the edit removed.
		await media.sync({
			ownerID: authorID,
			usages: [{ kind: 'post', refID: postID, urls: mediaUrls }],
		});

		return true;
	});

	if (!isUpdated) {
		return null;
	}

	// Read after the commit: inside the transaction the cache could keep uncommitted data.
	return prisma.post.findUnique({ where: { postID } });
}

/**
 * Soft delete. The row is kept (replies still point at it) but its text and files are cleared,
 * and the files are released to media-service so its sweeper can remove them. Ownership sits in
 * the where clause like in `updatePost`; false means "not found, not yours or already deleted".
 */
export async function deletePost(postID: string, authorID: string, media: MediaUsageClient) {
	return prisma.$transaction(async (tx) => {
		const result = await tx.post.updateMany({
			where: { postID, authorID, deletedAt: null },
			data: { content: '', media: [], deletedAt: new Date() },
		});

		if (result.count === 0) {
			return false;
		}

		// Nothing of the text may stay searchable.
		await indexTextEntities(tx, postID, '', []);

		await media.sync({
			ownerID: authorID,
			usages: [{ kind: 'post', refID: postID, urls: [] }],
		});

		return true;
	});
}

/**
 * Deletes any post on a moderator's behalf. Same soft delete as the author's (text and files are
 * cleared, the row stays), plus who did it and why. False when the post is missing or already
 * deleted.
 */
export async function removePostAsModerator(
	postID: string,
	moderatorID: string,
	reason: string | undefined,
	media: MediaUsageClient,
) {
	return prisma.$transaction(async (tx) => {
		const post = await tx.post.findUnique({
			where: { postID },
			select: { authorID: true, deletedAt: true },
		});

		if (!post || post.deletedAt) {
			return false;
		}

		await tx.post.update({
			where: { postID },
			data: {
				content: '',
				media: [],
				deletedAt: new Date(),
				removedByID: moderatorID,
				removalReason: reason || null,
			},
		});
		await indexTextEntities(tx, postID, '', []);

		// The files are released under the author's name, they own the uploads.
		await media.sync({
			ownerID: post.authorID,
			usages: [{ kind: 'post', refID: postID, urls: [] }],
		});

		return true;
	});
}

/** Latest posts for the moderation list, removed ones included (they show as placeholders). */
export async function getModerationPosts(
	limit: number = 50,
	userServiceUrl?: string,
	viewerID?: string | null,
) {
	const posts = await prisma.post.findMany({ take: limit, orderBy: { createdAt: 'desc' } });

	return decoratePosts(posts, { withAuthors: true, userServiceUrl, viewerID });
}

/** Posts matching a parsed search, newest first; deleted posts are never found. */
export async function searchPosts(
	search: ParsedSearch,
	limit: number = 30,
	userServiceUrl?: string,
	viewerID?: string | null,
	after?: ReturnType<typeof cursorFilter>,
) {
	const rows = await prisma.post.findMany({
		where: {
			deletedAt: null,
			...(after ?? {}),
			// eslint-disable-next-line @typescript-eslint/naming-convention
			AND: [
				...search.terms.map((term) => ({
					content: { contains: escapeLike(term), mode: 'insensitive' as const },
				})),
				...search.tags.map((tag) => ({ tags: { some: { tag } } })),
			],
		},
		take: limit + 1,
		orderBy: [{ createdAt: 'desc' }, { postID: 'desc' }],
	});

	return pageOf(rows, limit, (page) =>
		decoratePosts(page, { withAuthors: true, userServiceUrl, viewerID }),
	);
}

/** Hashtags by how many posts carry them: those starting with `q`, or containing it. */
export async function searchTags(
	q: string,
	match: 'prefix' | 'contains' = 'prefix',
	limit: number = 8,
): Promise<SearchTag[]> {
	const groups = await prisma.postTag.groupBy({
		by: ['tag'],
		where: {
			tag: match === 'contains' ? { contains: escapeLike(q) } : { startsWith: escapeLike(q) },
		},
		// eslint-disable-next-line @typescript-eslint/naming-convention
		_count: { tag: true },
		// eslint-disable-next-line @typescript-eslint/naming-convention
		orderBy: [{ _count: { tag: 'desc' } }, { tag: 'asc' }],
		take: limit,
	});

	return groups.map((group) => ({ tag: group.tag, count: group._count.tag }));
}

// Newest first; `tag` must already be normalized (see `normalizeHashtag`).
export async function getPostsByHashtag(
	tag: string,
	limit: number = 30,
	userServiceUrl?: string,
	viewerID?: string | null,
	after?: ReturnType<typeof cursorFilter>,
) {
	const rows = await prisma.post.findMany({
		where: { deletedAt: null, tags: { some: { tag } }, ...(after ?? {}) },
		take: limit + 1,
		orderBy: [{ createdAt: 'desc' }, { postID: 'desc' }],
	});

	return pageOf(rows, limit, (page) =>
		decoratePosts(page, { withAuthors: true, userServiceUrl, viewerID }),
	);
}

// The profile page already knows the author, so no call to user-service is made for it (only
// for the authors of the posts a reply answers).
export async function getPostsByAuthor(
	authorID: string,
	kind: 'posts' | 'replies',
	limit: number = 30,
	userServiceUrl?: string,
	viewerID?: string | null,
	after?: ReturnType<typeof cursorFilter>,
) {
	const rows = await prisma.post.findMany({
		where: {
			authorID,
			deletedAt: null,
			parentPostID: kind === 'replies' ? { not: null } : null,
			...(after ?? {}),
		},
		take: limit + 1,
		orderBy: [{ createdAt: 'desc' }, { postID: 'desc' }],
	});

	return pageOf(rows, limit, (page) =>
		decoratePosts(page, { withAuthors: false, userServiceUrl, viewerID }),
	);
}
