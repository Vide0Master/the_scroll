import { useEffect, useState } from 'react';
import type { SearchTag, UserProfile } from '@the-scroll/types';
import { api } from './api';
import { suggestionQuery } from './search';

export interface Suggestions {
	users: UserProfile[];
	tags: SearchTag[];
}

const NONE: Suggestions = { users: [], tags: [] };
const TYPING_PAUSE_MS = 200;

/** Accounts and hashtags matching what is typed in the search box (empty while loading). */
export function useSearchSuggestions(query: string): Suggestions {
	const [result, setResult] = useState<{ query: string; suggestions: Suggestions } | null>(null);
	const trimmed = query.trim();

	useEffect(() => {
		const { users, tags } = suggestionQuery(trimmed);

		if (!users && !tags) {
			return;
		}

		let isActive = true;
		// Waits for a pause in typing so each keystroke doesn't send requests.
		const timer = setTimeout(() => {
			Promise.all([
				users ? api.users.search(users).catch(() => null) : null,
				tags ? api.posts.tags(tags).catch(() => null) : null,
			]).then(([userResponse, tagResponse]) => {
				if (isActive) {
					setResult({
						query: trimmed,
						suggestions: {
							users: userResponse?.users ?? [],
							tags: tagResponse?.tags ?? [],
						},
					});
				}
			});
		}, TYPING_PAUSE_MS);

		return () => {
			isActive = false;
			clearTimeout(timer);
		};
	}, [trimmed]);

	return result?.query === trimmed ? result.suggestions : NONE;
}
