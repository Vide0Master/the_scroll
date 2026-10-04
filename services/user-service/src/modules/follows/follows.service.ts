import type { FollowStats } from '@the-scroll/types';
import { prisma } from '../../lib/prisma';
import { createNotification } from '../notifications/notifications.service';

export type FollowResult = 'ok' | 'notFound' | 'self';

/** Idempotent: following twice is fine. The person followed is notified the first time. */
export async function followUser(followerID: string, userName: string): Promise<FollowResult> {
	const target = await prisma.user.findUnique({
		where: { userName },
		select: { userID: true },
	});

	if (!target) {
		return 'notFound';
	}

	if (target.userID === followerID) {
		return 'self';
	}

	const existing = await prisma.follow.findUnique({
		// eslint-disable-next-line @typescript-eslint/naming-convention
		where: { followerID_followeeID: { followerID, followeeID: target.userID } },
	});

	if (!existing) {
		await prisma.follow.create({ data: { followerID, followeeID: target.userID } });
		await createNotification({
			recipientID: target.userID,
			actorID: followerID,
			type: 'FOLLOW',
		});
	}

	return 'ok';
}

export async function unfollowUser(followerID: string, userName: string): Promise<FollowResult> {
	const target = await prisma.user.findUnique({
		where: { userName },
		select: { userID: true },
	});

	if (!target) {
		return 'notFound';
	}

	await prisma.follow.deleteMany({ where: { followerID, followeeID: target.userID } });

	return 'ok';
}

/** Follower and following counts of an account; `viewerID` (when signed in) adds `isFollowing`. */
export async function getFollowStats(
	userName: string,
	viewerID?: string,
): Promise<FollowStats | null> {
	const target = await prisma.user.findUnique({
		where: { userName },
		select: { userID: true },
	});

	if (!target) {
		return null;
	}

	const [followerCount, followingCount, relation] = await Promise.all([
		prisma.follow.count({ where: { followeeID: target.userID } }),
		prisma.follow.count({ where: { followerID: target.userID } }),
		viewerID
			? prisma.follow.findUnique({
					where: {
						// eslint-disable-next-line @typescript-eslint/naming-convention
						followerID_followeeID: { followerID: viewerID, followeeID: target.userID },
					},
				})
			: null,
	]);

	return { followerCount, followingCount, isFollowing: relation !== null };
}

const FOLLOWING_IDS_LIMIT = 5000;

/** Ids of everyone `userID` follows, for post-service's "following" feed. */
export async function getFollowingIDs(userID: string): Promise<string[]> {
	const rows = await prisma.follow.findMany({
		where: { followerID: userID },
		select: { followeeID: true },
		take: FOLLOWING_IDS_LIMIT,
	});

	return rows.map((row) => row.followeeID);
}
