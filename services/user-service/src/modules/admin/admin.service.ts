import { escapeLike } from '@the-scroll/backend-core';
import type { AdminUser, UserMetrics, UserRole } from '@the-scroll/types';
import { prisma } from '../../lib/prisma';
import { publicUserSelect } from '../../lib/publicUser';
import { normalizeEmail } from '../auth/auth.service';

export interface Actor {
	userID: string;
	roles: UserRole[];
}

const ADMIN_LIST_LIMIT = 30;

/**
 * Who may block (or unblock) whom: nobody an admin, and only an admin a moderator; everyone else
 * by any moderator or admin. Nobody acts on themselves.
 */
function canModerate(actor: Actor, target: { userID: string; roles: UserRole[] }): boolean {
	if (actor.userID === target.userID || target.roles.includes('ADMIN')) {
		return false;
	}

	return target.roles.includes('MODERATOR') ? actor.roles.includes('ADMIN') : true;
}

/** Accounts for the panel, newest first (most recently blocked first when `banned`). */
export async function listAdminUsers(options: {
	query?: string;
	banned?: boolean;
	includeEmail: boolean;
}): Promise<AdminUser[]> {
	const { query, banned, includeEmail } = options;
	const users = await prisma.user.findMany({
		where: {
			...(banned ? { bannedAt: { not: null } } : {}),
			...(query
				? {
						// eslint-disable-next-line @typescript-eslint/naming-convention
						OR: [
							{
								userName: {
									contains: escapeLike(query),
									mode: 'insensitive' as const,
								},
							},
							{
								visibleName: {
									contains: escapeLike(query),
									mode: 'insensitive' as const,
								},
							},
							...(includeEmail
								? [
										{
											email: {
												contains: escapeLike(query),
												mode: 'insensitive' as const,
											},
										},
									]
								: []),
						],
					}
				: {}),
		},
		orderBy: banned ? { bannedAt: 'desc' } : { createdAt: 'desc' },
		take: ADMIN_LIST_LIMIT,
		select: { ...publicUserSelect, email: true, banReason: true },
	});

	return users.map((user) => ({
		userID: user.userID,
		userName: user.userName,
		visibleName: user.visibleName,
		avatarUrl: user.avatarUrl,
		roles: user.roles,
		isBanned: user.bannedAt !== null,
		banReason: user.banReason,
		bannedAt: user.bannedAt?.toISOString() ?? null,
		...(includeEmail ? { email: user.email } : {}),
		createdAt: user.createdAt.toISOString(),
	}));
}

export type ModerationResult = 'ok' | 'notFound' | 'forbidden' | 'unchanged';

/**
 * Blocks an account: marks it, ends all its sessions (it is logged out at once, everywhere) and
 * bars its email from registering again.
 */
export async function banUser(
	actor: Actor,
	userName: string,
	reason?: string,
): Promise<ModerationResult> {
	return prisma.$transaction(async (tx) => {
		const target = await tx.user.findUnique({ where: { userName } });

		if (!target) {
			return 'notFound';
		}

		if (!canModerate(actor, target)) {
			return 'forbidden';
		}

		if (target.bannedAt) {
			return 'unchanged';
		}

		await tx.user.update({
			where: { userID: target.userID },
			data: { bannedAt: new Date(), banReason: reason || null, bannedByID: actor.userID },
		});
		await tx.session.deleteMany({ where: { userID: target.userID } });
		await tx.blockedEmail.upsert({
			where: { email: normalizeEmail(target.email) },
			create: {
				email: normalizeEmail(target.email),
				reason: reason || null,
				blockedByID: actor.userID,
			},
			update: {},
		});

		return 'ok';
	});
}

/** Lifts a block; the account has to log in again, its old sessions are gone. */
export async function unbanUser(actor: Actor, userName: string): Promise<ModerationResult> {
	return prisma.$transaction(async (tx) => {
		const target = await tx.user.findUnique({ where: { userName } });

		if (!target) {
			return 'notFound';
		}

		if (!canModerate(actor, target)) {
			return 'forbidden';
		}

		if (!target.bannedAt) {
			return 'unchanged';
		}

		await tx.user.update({
			where: { userID: target.userID },
			data: { bannedAt: null, banReason: null, bannedByID: null },
		});
		await tx.blockedEmail.deleteMany({ where: { email: normalizeEmail(target.email) } });

		return 'ok';
	});
}

/** Head counts for the admin panel. */
export async function getUserMetrics(): Promise<UserMetrics> {
	const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
	const [users, banned, usersToday, follows] = await Promise.all([
		prisma.user.count(),
		prisma.user.count({ where: { bannedAt: { not: null } } }),
		prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
		prisma.follow.count(),
	]);

	return { users, banned, usersToday, follows };
}
