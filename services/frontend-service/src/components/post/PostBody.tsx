import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FeedPost } from '@the-scroll/types';
import { isVideoUrl, mediaGridColumns } from '../../scripts/media';
import { postPath } from '../../scripts/routes';
import { Lightbox } from '../Lightbox';
import { RichText } from '../RichText';

// Longer texts are folded in lists (not on the opened post) so one post cannot fill a screen.
const FOLD_LINES = 8;
const FOLD_CHARACTERS = 500;

const linkButtonClass =
	'pointer-events-auto mt-1 bg-none border-none p-0 font-mono text-xs lowercase text-accent cursor-pointer hover:underline';

export interface PostBodyProps {
	post: FeedPost;
	isOpened: boolean;
}

/** What a post says: the "replying to" line, the text (folded when long) and its media. */
export function PostBody({ post, isOpened }: PostBodyProps) {
	const { t } = useTranslation();
	const [isExpanded, setIsExpanded] = useState(false);
	const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
	const { content, media } = post;
	const images = media.filter((url) => !isVideoUrl(url));
	const isLong = content.length > FOLD_CHARACTERS || content.split('\n').length > FOLD_LINES;
	const isFolded = isLong && !isOpened && !isExpanded;

	return (
		<>
			<div className='relative pointer-events-none'>
				{post.replyTo && (
					<Link
						to={postPath(post.replyTo.postID)}
						className='pointer-events-auto inline-block mb-1 font-mono text-xs text-muted hover:underline'
					>
						{post.replyTo.isDeleted
							? t('post.replyingToDeleted')
							: t('post.replyingTo', {
									name: post.replyTo.author
										? `@${post.replyTo.author.userName}`
										: '…',
								})}
					</Link>
				)}

				{post.isDeleted && (
					<p className='text-sm italic text-muted'>
						{t(post.removedByModerator ? 'post.removed' : 'post.deleted')}
					</p>
				)}

				{content && (
					<>
						<p
							className={`text-[15px] leading-relaxed whitespace-pre-wrap break-words ${isFolded ? 'line-clamp-[8]' : ''}`}
						>
							<RichText
								text={content}
								mentions={post.mentions}
							/>
						</p>
						{isLong && !isOpened && (
							<button
								type='button'
								onClick={() => setIsExpanded((current) => !current)}
								className={linkButtonClass}
							>
								{t(isExpanded ? 'post.showLess' : 'post.showMore')}
							</button>
						)}
					</>
				)}

				{media.length > 0 && (
					<div
						className='mt-2 grid gap-2 overflow-hidden'
						style={{
							gridTemplateColumns: `repeat(${mediaGridColumns(media.length)}, minmax(0, 1fr))`,
						}}
					>
						{media.map((url) =>
							isVideoUrl(url) ? (
								<div
									key={url}
									className='pointer-events-auto bg-panel border border-line overflow-hidden aspect-video'
								>
									<video
										src={url}
										muted
										controls
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
									className='bg-panel border border-line overflow-hidden aspect-video p-0 cursor-zoom-in pointer-events-auto'
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
