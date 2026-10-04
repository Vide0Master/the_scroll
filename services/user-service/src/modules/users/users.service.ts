import { escapeLike } from '@the-scroll/backend-core';
import type { UserRole } from '@the-scroll/types';
import { prisma } from '../../lib/prisma';
import { publicUserSelect, toPublicUser } from '../../lib/publicUser';

export async function getSessionUser(sessionID: string) {
	const session = await prisma.session.findUnique({
		where: { sessionID },
		include: { user: { select: publicUserSelect } },
	});

	// A banned account has no sessions left (banning deletes them); this is the second lock.
	return session && !session.user.bannedAt ? toPublicUser(session.user) : null;
}

export async function getUserByUsername(rawUserName: string) {
	const cleanName = rawUserName.replace(/^@/, '');
	const user = await prisma.user.findUnique({
		where: { userName: cleanName },
		select: publicUserSelect,
	});

	return user ? toPublicUser(user) : null;
}

/** `activeOnly` leaves out blocked accounts (for listings that promote people, like trends). */
export async function getUsersByIds(userIDs: string[], activeOnly = false) {
	const users = await prisma.user.findMany({
		where: {
			userID: {
				in: userIDs,
			},
			...(activeOnly ? { bannedAt: null } : {}),
		},
		select: publicUserSelect,
	});

	return users.map(toPublicUser);
}

export async function getUsersByNames(userNames: string[]) {
	const users = await prisma.user.findMany({
		where: { userName: { in: userNames } },
		select: publicUserSelect,
	});

	return users.map(toPublicUser);
}

const SEARCH_RESULT_LIMIT = 8;

/**
 * Public account search by username or visible name, case-insensitively: the start of either
 * (hints while typing) or anywhere in it (`contains`). Blocked accounts are not offered.
 */
export async function searchUsers(
	query: string,
	options: { match?: 'prefix' | 'contains'; limit?: number } = {},
) {
	const { match = 'prefix', limit = SEARCH_RESULT_LIMIT } = options;
	const condition = match === 'contains' ? 'contains' : 'startsWith';
	const users = await prisma.user.findMany({
		where: {
			bannedAt: null,
			// eslint-disable-next-line @typescript-eslint/naming-convention
			OR: [
				{ userName: { [condition]: escapeLike(query), mode: 'insensitive' } },
				{ visibleName: { [condition]: escapeLike(query), mode: 'insensitive' } },
			],
		},
		orderBy: { userName: 'asc' },
		take: limit,
		select: publicUserSelect,
	});

	return users.map(toPublicUser);
}

/** Replaces an account's roles; null when there is no such account. */
export async function setUserRoles(userName: string, roles: UserRole[]) {
	const result = await prisma.user.updateMany({ where: { userName }, data: { roles } });

	if (result.count === 0) {
		return null;
	}

	// Read after the write: inside one call the cached copy could still hold the old roles.
	return getUserByUsername(userName);
}
