import { createContext, useContext } from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'event';

export interface ToastInput {
	message: string;
	kind?: ToastKind;
	/** Makes the toast a link; clicking it dismisses it and goes there. */
	to?: string;
	/** Runs when the toast is opened through its link. */
	onOpen?: () => void;
	/** A button on the toast ("Retry"); clicking it runs `onClick` and dismisses the toast. */
	action?: { label: string; onClick: () => void };
	/** Milliseconds on screen; errors stay longer by default. */
	durationMs?: number;
}

export interface ToastContextValue {
	show: (toast: ToastInput) => void;
	/** Whether live-event toasts (`kind: 'event'`) are on; results of the user's own actions always show. */
	areEventToastsEnabled: boolean;
	setEventToastsEnabled: (isEnabled: boolean) => void;
}

export const toastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
	const value = useContext(toastContext);
	if (!value) {
		throw new Error('useToast must be used inside ToastProvider');
	}
	return value;
}
