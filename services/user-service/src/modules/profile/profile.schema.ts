import { z } from 'zod';
import { PROFILE_VISIBLE_NAME_MAX_LENGTH } from '@the-scroll/types';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// Only files served by media-service: a fixed path shape, so a profile can't point at another
// site (tracking pixels) or smuggle in a `javascript:` URL. Extensions are images only.
const profileImageUrl = z
	.string()
	.regex(
		/^\/api\/media\/file\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp|gif)$/i,
	);

export const profileUpdateSchema = z
	.strictObject({
		visibleName: z.string().trim().min(1).max(PROFILE_VISIBLE_NAME_MAX_LENGTH).nullable(),
		avatarUrl: profileImageUrl.nullable(),
		bannerUrl: profileImageUrl.nullable(),
		bannerGradient: z.strictObject({ from: hexColor, to: hexColor }).nullable(),
	})
	// One banner at a time: an image or a gradient.
	.refine((profile) => !(profile.bannerUrl && profile.bannerGradient), {
		message: 'Choose either a banner image or a gradient',
		path: ['bannerGradient'],
	});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
