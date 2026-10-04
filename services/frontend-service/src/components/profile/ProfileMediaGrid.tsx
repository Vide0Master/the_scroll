import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FeedPost } from '@the-scroll/types';
import { isVideoUrl } from '../../scripts/media';
import { Lightbox } from '../Lightbox';

export interface ProfileMediaGridProps {
	posts: FeedPost[];
}

// Reuses the posts already loaded for the Posts tab — no separate media endpoint.
export function ProfileMediaGrid({ posts }: ProfileMediaGridProps) {
	const { t } = useTranslation();
	const urls = posts.flatMap((post) => post.media);
	const images = urls.filter((url) => !isVideoUrl(url));
	const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

	if (urls.length === 0) {
		return <div className='p-8 text-center text-sm text-muted'>{t('profile.noMedia')}</div>;
	}

	return (
		<>
			<div className='grid grid-cols-3 gap-px bg-line'>
				{urls.map((url) =>
					isVideoUrl(url) ? (
						<div
							key={url}
							className='aspect-square bg-panel overflow-hidden'
						>
							<video
								src={url}
								muted
								className='w-full h-full object-cover'
							/>
						</div>
					) : (
						<button
							key={url}
							type='button'
							aria-label={t('post.viewImage', {
								index: images.indexOf(url) + 1,
								total: images.length,
							})}
							onClick={() => setLightboxIndex(images.indexOf(url))}
							className='aspect-square bg-panel overflow-hidden p-0 cursor-zoom-in'
						>
							<img
								src={url}
								alt=''
								className='w-full h-full object-cover'
							/>
						</button>
					),
				)}
			</div>

			{lightboxIndex !== null && (
				<Lightbox
					images={images}
					index={lightboxIndex}
					onClose={() => setLightboxIndex(null)}
					onNavigate={setLightboxIndex}
				/>
			)}
		</>
	);
}
