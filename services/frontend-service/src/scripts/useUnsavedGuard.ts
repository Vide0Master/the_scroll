import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Warns before unsaved work is lost: closing or reloading the tab shows the browser's own
 * prompt; leaving through a link in the app is held back (`isBlocked`) until `stay` or `leave`.
 */
export function useUnsavedGuard(isDirty: boolean) {
	const blocker = useBlocker(isDirty);

	useEffect(() => {
		if (!isDirty) {
			return;
		}

		const warn = (event: BeforeUnloadEvent) => event.preventDefault();

		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	}, [isDirty]);

	return {
		isBlocked: blocker.state === 'blocked',
		stay: () => blocker.reset?.(),
		leave: () => blocker.proceed?.(),
	};
}
