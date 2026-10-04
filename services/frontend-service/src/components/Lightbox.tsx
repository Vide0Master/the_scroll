import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';

export interface LightboxProps {
	images: string[];
	index: number;
	onClose: () => void;
	onNavigate: (index: number) => void;
}

// A fullscreen image viewer, separate from Popup: Popup is a fixed max-w-md dialog and doesn't
// fit a fullscreen viewer. Shares Popup's focus/Esc pattern.
export function Lightbox({ images, index, onClose, onNavigate }: LightboxProps) {
	const { t } = useTranslation();
	const dialogRef = useRef<HTMLDivElement>(null);
	const hasMultiple = images.length > 1;

	useEffect(() => {
		const previouslyFocused = document.activeElement as HTMLElement | null;
		dialogRef.current?.focus();

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
			} else if (event.key === 'ArrowLeft' && hasMultiple) {
				onNavigate((index - 1 + images.length) % images.length);
			} else if (event.key === 'ArrowRight' && hasMultiple) {
				onNavigate((index + 1) % images.length);
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
			previouslyFocused?.focus();
		};
	}, [index, images.length, hasMultiple, onClose, onNavigate]);

	return createPortal(
		<div
			ref={dialogRef}
			role='dialog'
			aria-modal='true'
			aria-label={t('post.viewImage', { index: index + 1, total: images.length })}
			tabIndex={-1}
			onClick={onClose}
			className='fixed inset-0 z-50 flex items-center justify-center bg-black/90 outline-none'
		>
			<button
				type='button'
				aria-label={t('post.closeImage')}
				onClick={onClose}
				className='absolute top-4 right-4 p-2 text-white/80 hover:text-white'
			>
				<XMarkIcon
					className='w-7 h-7'
					strokeWidth={1.25}
				/>
			</button>

			{hasMultiple && (
				<button
					type='button'
					aria-label={t('post.previousImage')}
					onClick={(event) => {
						event.stopPropagation();
						onNavigate((index - 1 + images.length) % images.length);
					}}
					className='absolute left-2 sm:left-4 p-2 text-white/80 hover:text-white'
				>
					<ChevronLeftIcon
						className='w-8 h-8'
						strokeWidth={1.25}
					/>
				</button>
			)}

			<img
				src={images[index]}
				alt=''
				onClick={(event) => event.stopPropagation()}
				className='max-w-[90vw] max-h-[90vh] object-contain'
			/>

			{hasMultiple && (
				<button
					type='button'
					aria-label={t('post.nextImage')}
					onClick={(event) => {
						event.stopPropagation();
						onNavigate((index + 1) % images.length);
					}}
					className='absolute right-2 sm:right-4 p-2 text-white/80 hover:text-white'
				>
					<ChevronRightIcon
						className='w-8 h-8'
						strokeWidth={1.25}
					/>
				</button>
			)}
		</div>,
		document.body,
	);
}
