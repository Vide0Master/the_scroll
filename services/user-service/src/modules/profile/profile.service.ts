import type { MediaUsageClient } from '@the-scroll/backend-core';
import { prisma } from '../../lib/prisma';
import { publicUserSelect, toPublicUser } from '../../lib/publicUser';
import type { ProfileUpdateInput } from './profile.schema';

/**
 * Replaces the editable profile fields of `userID` and returns the public view of the account.
 * The avatar and banner files are reported to media-service in the same transaction, so a
 * refused or unreachable media-service means nothing is saved (and files the profile stops using
 * are released for the orphan sweep).
 */
export async function updateProfile(
	userID: string,
	profile: ProfileUpdateInput,
	media: MediaUsageClient,
) {
	const user = await prisma.$transaction(async (tx) => {
		const updated = await tx.user.update({
			where: { userID },
			data: {
				visibleName: profile.visibleName,
				avatarUrl: profile.avatarUrl,
				bannerUrl: profile.bannerUrl,
				bannerGradientFrom: profile.bannerGradient?.from ?? null,
				bannerGradientTo: profile.bannerGradient?.to ?? null,
			},
			select: publicUserSelect,
		});

		await media.sync({
			ownerID: userID,
			usages: [
				{
					kind: 'avatar',
					refID: userID,
					urls: profile.avatarUrl ? [profile.avatarUrl] : [],
				},
				{
					kind: 'banner',
					refID: userID,
					urls: profile.bannerUrl ? [profile.bannerUrl] : [],
				},
			],
		});

		return updated;
	});

	return toPublicUser(user);
}
