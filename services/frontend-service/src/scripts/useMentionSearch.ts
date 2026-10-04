import { useEffect, useState } from 'react';
import type { UserProfile } from '@the-scroll/types';
import { api } from './api';

const TYPING_PAUSE_MS = 150;

/** Accounts matching what is being typed after an "@" (empty while `query` is null or loading). */
export function useMentionSearch(query: string | null): UserProfile[] {
	const [result, setResult] = useState<{ query: string; users: UserProfile[] } | null>(null);

	useEffect(() => {
		if (!query) {
			return;
		}

		let isActive = true;
		// Waits for a pause in typing so each keystroke doesn't send a request.
		const timer = setTimeout(() => {
			api.users
				.search(query)
				.then((response) => {
					if (isActive) {
						setResult({ query, users: response.users ?? [] });
					}
				})
				.catch(() => undefined);
		}, TYPING_PAUSE_MS);

		return () => {
			isActive = false;
			clearTimeout(timer);
		};
	}, [query]);

	return query && result?.query === query ? result.users : [];
}
