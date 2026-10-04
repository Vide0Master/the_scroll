import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/16/solid';

export interface PopupProps {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	children: ReactNode;
	footer?: ReactNode;
	/** No padding around the content: it lays out its own edge-to-edge dividers (post editor). */
	isFlush?: boolean;
}

export function Popup({ isOpen, onClose, title, children, footer, isFlush = false }: PopupProps) {
	const dialogRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const previouslyFocused = document.activeElement as HTMLElement | null;
		dialogRef.current?.focus();

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
			previouslyFocused?.focus();
		};
	}, [isOpen, onClose]);

	if (!isOpen) {
		return null;
	}

	return createPortal(
		<div
			className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'
			onClick={onClose}
		>
			<div
				ref={dialogRef}
				role='dialog'
				aria-modal='true'
				aria-label={title}
				tabIndex={-1}
				onClick={(event) => event.stopPropagation()}
				className='flex flex-col w-full max-w-md bg-surface text-main border border-line outline-none'
			>
				<div className='flex items-center justify-between gap-2 px-4 py-2 border-b border-line'>
					<span className='font-mono text-xs font-semibold uppercase tracking-wider text-muted'>
						{title}
					</span>
					<button
						type='button'
						aria-label='Close'
						onClick={onClose}
					>
						<XMarkIcon height={16} />
					</button>
				</div>

				<div className={isFlush ? '' : 'p-4'}>{children}</div>

				{footer && (
					<div className='flex justify-end gap-2 px-4 py-3 border-t border-line'>
						{footer}
					</div>
				)}
			</div>
		</div>,
		document.body,
	);
}
