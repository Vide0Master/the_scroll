import { useEffect, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ActiveToast } from '../providers/ToastProvider';
import type { ToastKind } from '../providers/ToastContext';

const DEFAULT_MS = 4000;
const ERROR_MS = 6000;

const markerClass: Record<ToastKind, string> = {
	success: 'bg-green-600',
	error: 'bg-red-600',
	info: 'bg-muted',
	event: 'bg-accent',
};

interface ToastItemProps {
	toast: ActiveToast;
	onDismiss: (id: number) => void;
	onNavigate: (to: string) => void;
}

function ToastItem({ toast, onDismiss, onNavigate }: ToastItemProps) {
	const { t } = useTranslation();
	const [isPaused, setIsPaused] = useState(false);
	const { id, revision, kind, durationMs } = toast;

	// Runs while the pointer or focus is away; a repeat of the same toast starts it over.
	useEffect(() => {
		if (isPaused) {
			return;
		}

		const timer = setTimeout(
			() => onDismiss(id),
			durationMs ?? (kind === 'error' ? ERROR_MS : DEFAULT_MS),
		);

		return () => clearTimeout(timer);
	}, [isPaused, id, revision, kind, durationMs, onDismiss]);

	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			event.stopPropagation();
			onDismiss(id);
		}
	};

	const body = (
		<>
			<span
				aria-hidden='true'
				className={`w-2 h-2 shrink-0 mt-1 ${markerClass[kind]}`}
			/>
			<span className='min-w-0 flex-1 break-words'>{toast.message}</span>
		</>
	);

	return (
		<div
			role={kind === 'error' ? 'alert' : 'status'}
			onMouseEnter={() => setIsPaused(true)}
			onMouseLeave={() => setIsPaused(false)}
			onFocus={() => setIsPaused(true)}
			onBlur={() => setIsPaused(false)}
			onKeyDown={handleKeyDown}
			className='toast-in pointer-events-auto w-full max-w-sm flex items-start gap-3 bg-surface border border-line px-3 py-2 font-mono text-xs'
		>
			{toast.to ? (
				<button
					type='button'
					onClick={() => {
						onDismiss(id);
						toast.onOpen?.();
						onNavigate(toast.to!);
					}}
					className='flex flex-1 min-w-0 items-start gap-3 bg-none border-none p-0 text-left font-mono text-inherit hover:underline'
				>
					{body}
				</button>
			) : (
				<div className='flex flex-1 min-w-0 items-start gap-3'>{body}</div>
			)}

			{toast.action && (
				<button
					type='button'
					onClick={() => {
						toast.action?.onClick();
						onDismiss(id);
					}}
					className='shrink-0 bg-none border-none p-0 font-mono uppercase text-accent hover:underline'
				>
					{toast.action.label}
				</button>
			)}

			<button
				type='button'
				aria-label={t('toast.close')}
				onClick={() => onDismiss(id)}
				className='shrink-0 bg-none border-none p-0 text-muted hover:text-main'
			>
				<XMarkIcon
					className='w-4 h-4'
					strokeWidth={1.5}
				/>
			</button>
		</div>
	);
}

export interface ToastRegionProps {
	toasts: ActiveToast[];
	onDismiss: (id: number) => void;
	onNavigate: (to: string) => void;
}

/**
 * The stack of toasts, newest on top. The container ignores the pointer (only the toasts take
 * it), so the sticky page header underneath stays clickable around them.
 */
export function ToastRegion({ toasts, onDismiss, onNavigate }: ToastRegionProps) {
	const { t } = useTranslation();

	return (
		<div
			aria-label={t('toast.region')}
			className='pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col-reverse items-center gap-2 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] sm:items-end sm:pr-4'
		>
			{toasts.map((toast) => (
				<ToastItem
					key={toast.id}
					toast={toast}
					onDismiss={onDismiss}
					onNavigate={onNavigate}
				/>
			))}
		</div>
	);
}
