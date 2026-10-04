import type { UserProfile, UserRole } from '@the-scroll/types';

// What any client may see of an account. Never widen this to include email or password.
export const publicUserSelect = {
	userID: true,
	userName: true,
	visibleName: true,
	avatarUrl: true,
	bannerUrl: true,
	bannerGradientFrom: true,
	bannerGradientTo: true,
	roles: true,
	bannedAt: true,
	createdAt: true,
} as const;

interface PublicUserRow {
	userID: string;
	userName: string;
	visibleName: string | null;
	avatarUrl: string | null;
	bannerUrl: string | null;
	bannerGradientFrom: string | null;
	bannerGradientTo: string | null;
	roles: UserRole[];
	bannedAt: Date | null;
	createdAt: Date;
}

/** Folds the two gradient columns into the `bannerGradient` object clients expect. */
export function toPublicUser(row: PublicUserRow): UserProfile {
	const { bannerGradientFrom, bannerGradientTo, bannedAt, ...rest } = row;

	return {
		...rest,
		isBanned: bannedAt !== null,
		bannerGradient:
			bannerGradientFrom && bannerGradientTo
				? { from: bannerGradientFrom, to: bannerGradientTo }
				: null,
	};
}
