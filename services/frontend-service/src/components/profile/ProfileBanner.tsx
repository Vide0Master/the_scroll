import type { BannerGradient } from '@the-scroll/types';
import { gradientCss } from '../../scripts/palette';

export interface ProfileBannerProps {
	bannerUrl: string | null;
	bannerGradient: BannerGradient | null;
}

/** The wide strip on top of a profile: a picture, a gradient, or the theme's accent fallback. */
export function ProfileBanner({ bannerUrl, bannerGradient }: ProfileBannerProps) {
	if (bannerUrl) {
		return (
			<img
				src={bannerUrl}
				alt=''
				aria-hidden='true'
				className='block w-full h-32 sm:h-48 object-cover'
			/>
		);
	}

	if (bannerGradient) {
		return (
			<div
				aria-hidden='true'
				data-testid='banner-gradient'
				className='h-32 sm:h-48'
				style={{ backgroundImage: gradientCss(bannerGradient) }}
			/>
		);
	}

	return (
		<div
			aria-hidden='true'
			className='h-32 sm:h-48 bg-linear-to-br from-accent to-panel'
		/>
	);
}
