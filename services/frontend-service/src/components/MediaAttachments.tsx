import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { isVideoUrl, mediaGridColumns } from '../scripts/media';

/** A file that is still uploading: shown from the local copy until the server has it. */
export interface PendingUpload {
	id: string;
	name: string;
	previewUrl: string;
	isVideo: boolean;
}

export interface MediaAttachmentsProps {
	urls: string[];
	pending: PendingUpload[];
	onRemove: (index: number) => void;
}

/** The files attached to a post being written: uploaded ones (removable) and those on their way. */
export function MediaAttachments({ urls, pending, onRemove }: MediaAttachmentsProps) {
	const { t } = useTranslation();
	const total = urls.length + pending.length;

	if (total === 0) {
		return null;
	}

	return (
		<div
			className='grid gap-2 px-4 pb-4'
			style={{ gridTemplateColumns: `repeat(${mediaGridColumns(total)}, minmax(0, 1fr))` }}
		>
			{urls.map((url, index) => (
				<div
					key={url}
					className='relative overflow-hidden bg-panel border border-line aspect-video'
				>
					{isVideoUrl(url) ? (
						<video
							src={url}
							muted
							className='w-full h-full object-cover'
						/>
					) : (
						<img
							src={url}
							alt=''
							className='w-full h-full object-cover'
						/>
					)}
					<button
						type='button'
						aria-label={t('post.removeAttachment')}
						onClick={() => onRemove(index)}
						className='absolute top-2 right-2 p-1 bg-surface/80 hover:bg-surface text-main border border-line transition-colors'
					>
						<XMarkIcon
							className='w-4 h-4'
							strokeWidth={1.25}
						/>
					</button>
				</div>
			))}

			{pending.map((upload) => (
				<div
					key={upload.id}
					title={upload.name}
					className='relative overflow-hidden bg-panel border border-line aspect-video'
				>
					{upload.isVideo ? (
						<video
							src={upload.previewUrl}
							muted
							className='w-full h-full object-cover opacity-50'
						/>
					) : (
						<img
							src={upload.previewUrl}
							alt=''
							className='w-full h-full object-cover opacity-50'
						/>
					)}
					<span className='absolute inset-0 flex items-center justify-center font-mono text-xs text-main animate-pulse'>
						{t('post.uploading')}
					</span>
				</div>
			))}
		</div>
	);
}
