import {
	TREND_WINDOW_DAYS,
	type AuthorProfile,
	type PostMetrics,
	type TrendingTag,
	type TrendingUser,
} from '@the-scroll/types';
import type { Notifier } from '../../lib/notifier';
import { prisma } from '../../lib/prisma';

const DAY_MS = 24 * 60 * 60 * 1000;
const TRENDS_CACHE_MS = 30 * 1000;

export interface TrendingUserScore {
	userID: string;
	score: number;
}

/**
 * Likes and replies count as activity, but only from other people: an account liking or
 * answering its own posts does not push them up. Deleted posts never trend. Raw SQL because it
 * joins three tables by event time; the numbers are recomputed (at most every 30 s) rather than
 * stored, so there is nothing to keep in sync.
 */
async function computeTrends(limit: number) {
	const since = new Date(Date.now() - TREND_WINDOW_DAYS * DAY_MS);

	const [tags, users] = await Promise.all([
		prisma.$queryRaw<{ tag: string; score: number }[]>`
			SELECT tag, SUM(score)::int AS score FROM (
				SELECT t."tag", COUNT(*) AS score
				FROM "PostLike" l
				JOIN "Post" p ON p."postID" = l."postID" AND p."deletedAt" IS NULL
				JOIN "PostTag" t ON t."postID" = p."postID"
				WHERE l."createdAt" >= ${since} AND l."userID" <> p."authorID"
				GROUP BY t."tag"
				UNION ALL
				SELECT t."tag", COUNT(*) AS score
				FROM "Post" r
				JOIN "Post" p ON p."postID" = r."parentPostID" AND p."deletedAt" IS NULL
				JOIN "PostTag" t ON t."postID" = p."postID"
				WHERE r."createdAt" >= ${since} AND r."deletedAt" IS NULL AND r."authorID" <> p."authorID"
				GROUP BY t."tag"
			) activity
			GROUP BY tag
			ORDER BY score DESC, tag ASC
			LIMIT ${limit}`,
		prisma.$queryRaw<{ userID: string; score: number }[]>`
			SELECT "userID", SUM(score)::int AS score FROM (
				SELECT p."authorID" AS "userID", COUNT(*) AS score
				FROM "PostLike" l
				JOIN "Post" p ON p."postID" = l."postID" AND p."deletedAt" IS NULL
				WHERE l."createdAt" >= ${since} AND l."userID" <> p."authorID"
				GROUP BY p."authorID"
				UNION ALL
				SELECT p."authorID" AS "userID", COUNT(*) AS score
				FROM "Post" r
				JOIN "Post" p ON p."postID" = r."parentPostID" AND p."deletedAt" IS NULL
				WHERE r."createdAt" >= ${since} AND r."deletedAt" IS NULL AND r."authorID" <> p."authorID"
				GROUP BY p."authorID"
			) activity
			GROUP BY "userID"
			ORDER BY score DESC, "userID" ASC
			LIMIT ${limit}`,
	]);

	return { tags, users };
}

let cached: { at: number; limit: number; value: Awaited<ReturnType<typeof computeTrends>> } | null =
	null;

/** Most active hashtags and authors of the last few days (memoized for 30 s). */
export async function getTrends(limit: number) {
	if (cached && cached.limit >= limit && Date.now() - cached.at < TRENDS_CACHE_MS) {
		return {
			tags: cached.value.tags.slice(0, limit),
			users: cached.value.users.slice(0, limit),
		};
	}

	const value = await computeTrends(limit);
	cached = { at: Date.now(), limit, value };

	return value;
}

/** Forget memoized trends (tests need fresh numbers right after they act). */
export function resetTrendsCache() {
	cached = null;
}

/**
 * Likes `postID` for `userID` (again is a no-op); null when the post is missing or deleted. A new
 * like tells the author (best effort, never for their own post).
 */
export async function likePost(
	postID: string,
	userID: string,
	notifier?: Notifier,
): Promise<number | null> {
	const post = await prisma.post.findUnique({
		where: { postID },
		select: { deletedAt: true, authorID: true },
	});

	if (!post || post.deletedAt) {
		return null;
	}

	const { count } = await prisma.postLike.createMany({
		data: [{ postID, userID }],
		skipDuplicates: true,
	});
	resetTrendsCache();

	if (count > 0 && post.authorID !== userID) {
		// Not awaited: the answer must not wait for user-service.
		void notifier?.send([
			{ recipientID: post.authorID, actorID: userID, type: 'LIKE', postID },
		]);
	}

	return prisma.postLike.count({ where: { postID } });
}

/** Removes the like (again is a no-op); null when the post does not exist. */
export async function unlikePost(postID: string, userID: string): Promise<number | null> {
	const post = await prisma.post.findUnique({ where: { postID }, select: { postID: true } });

	if (!post) {
		return null;
	}

	await prisma.postLike.deleteMany({ where: { postID, userID } });
	resetTrendsCache();

	return prisma.postLike.count({ where: { postID } });
}

/** One view per account; the author's own views and views of deleted posts are ignored. */
export async function recordView(postID: string, userID: string): Promise<boolean> {
	const post = await prisma.post.findUnique({
		where: { postID },
		select: { authorID: true, deletedAt: true },
	});

	if (!post || post.deletedAt) {
		return false;
	}

	if (post.authorID !== userID) {
		await prisma.postView.createMany({ data: [{ postID, userID }], skipDuplicates: true });
	}

	return true;
}

/** Numbers for the admin panel. */
export async function getPostMetrics(): Promise<PostMetrics> {
	const dayAgo = new Date(Date.now() - DAY_MS);
	const live = { deletedAt: null };

	const [posts, replies, deleted, likes, views, postsToday, likesToday, viewsToday, tags, top] =
		await Promise.all([
			prisma.post.count({ where: { ...live, parentPostID: null } }),
			prisma.post.count({ where: { ...live, parentPostID: { not: null } } }),
			prisma.post.count({ where: { deletedAt: { not: null } } }),
			prisma.postLike.count(),
			prisma.postView.count(),
			prisma.post.count({ where: { ...live, createdAt: { gte: dayAgo } } }),
			prisma.postLike.count({ where: { createdAt: { gte: dayAgo } } }),
			prisma.postView.count({ where: { createdAt: { gte: dayAgo } } }),
			getTrends(5).then((trends): TrendingTag[] => trends.tags),
			prisma.postView.groupBy({
				by: ['postID'],
				where: { post: live },
				// eslint-disable-next-line @typescript-eslint/naming-convention
				_count: { postID: true },
				// eslint-disable-next-line @typescript-eslint/naming-convention
				orderBy: { _count: { postID: 'desc' } },
				take: 5,
			}),
		]);

	const likeCounts = await prisma.postLike.groupBy({
		by: ['postID'],
		where: { postID: { in: top.map((row) => row.postID) } },
		// eslint-disable-next-line @typescript-eslint/naming-convention
		_count: { postID: true },
	});
	const likesByPost = new Map(likeCounts.map((row) => [row.postID, row._count.postID]));

	return {
		posts,
		replies,
		deleted,
		likes,
		views,
		postsToday,
		likesToday,
		viewsToday,
		topTags: tags,
		topPosts: top.map((row) => ({
			postID: row.postID,
			views: row._count.postID,
			likes: likesByPost.get(row.postID) ?? 0,
		})),
	};
}

/**
 * Attaches profiles to the scored authors, skipping blocked accounts (user-service leaves them
 * out) and any it cannot resolve. Keeps the score order.
 */
export async function resolveTrendingUsers(
	scores: TrendingUserScore[],
	userServiceUrl: string,
): Promise<TrendingUser[]> {
	if (scores.length === 0) {
		return [];
	}

	try {
		const response = await fetch(`${userServiceUrl}/users/by-ids`, {
			method: 'POST',
			headers: {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ userIDs: scores.map(({ userID }) => userID), activeOnly: true }),
		});

		if (!response.ok) {
			return [];
		}

		const data = (await response.json()) as { users?: AuthorProfile[] };
		const byID = new Map((data.users ?? []).map((user) => [user.userID, user]));

		return scores.flatMap(({ userID, score }) => {
			const user = byID.get(userID);
			return user ? [{ user, score }] : [];
		});
	} catch (error) {
		console.error('Failed to resolve trending users:', error);
		return [];
	}
}
