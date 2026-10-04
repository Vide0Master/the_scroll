import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastRegion } from '../components/ToastRegion';
import { readJSON, writeJSON } from '../scripts/storage';
import { toastContext, type ToastInput, type ToastKind } from './ToastContext';

export interface ActiveToast extends ToastInput {
	id: number;
	kind: ToastKind;
	/** Bumped when the same toast is shown again, which restarts its timer. */
	revision: number;
}

const MAX_VISIBLE = 3;
const EVENT_TOASTS_KEY = 'toasts:events';

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

/**
 * Small notices at the top of the screen: results of actions and live events. At most three show
 * at once (the rest wait their turn), and an identical toast shown again only restarts the timer
 * of the one already there. `navigate` is passed in because this sits above the router.
 */
export function ToastProvider({
	navigate,
	children,
}: {
	navigate: (to: string) => void;
	children: ReactNode;
}) {
	const [toasts, setToasts] = useState<ActiveToast[]>([]);
	const [areEventToastsEnabled, setAreEventToastsEnabled] = useState(() =>
		readJSON(EVENT_TOASTS_KEY, true, isBoolean),
	);
	const nextID = useRef(1);

	const show = useCallback((input: ToastInput) => {
		const kind = input.kind ?? 'info';

		setToasts((current) => {
			const same = current.find(
				(toast) => toast.kind === kind && toast.message === input.message,
			);

			if (same) {
				return current.map((toast) =>
					toast === same ? { ...toast, revision: toast.revision + 1 } : toast,
				);
			}

			return [...current, { ...input, kind, id: nextID.current++, revision: 0 }];
		});
	}, []);

	const dismiss = useCallback((id: number) => {
		setToasts((current) => current.filter((toast) => toast.id !== id));
	}, []);

	const setEventToastsEnabled = useCallback((isEnabled: boolean) => {
		setAreEventToastsEnabled(isEnabled);
		writeJSON(EVENT_TOASTS_KEY, isEnabled);
	}, []);

	const value = useMemo(
		() => ({ show, areEventToastsEnabled, setEventToastsEnabled }),
		[show, areEventToastsEnabled, setEventToastsEnabled],
	);

	return (
		<toastContext.Provider value={value}>
			{children}
			<ToastRegion
				toasts={toasts.slice(0, MAX_VISIBLE)}
				onDismiss={dismiss}
				onNavigate={navigate}
			/>
		</toastContext.Provider>
	);
}
