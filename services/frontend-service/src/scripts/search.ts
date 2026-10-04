// What the search box asks the server for while typing: "#word" only hashtags, "@word" only
// people, anything else both.

export interface SuggestionQuery {
	/** Text to look up among accounts, or null when people are not wanted. */
	users: string | null;
	/** Text to look up among hashtags (without "#"), or null when tags are not wanted. */
	tags: string | null;
}

export function suggestionQuery(raw: string): SuggestionQuery {
	const query = raw.trim();

	if (query.startsWith('#')) {
		const tag = query.slice(1);
		return { users: null, tags: tag || null };
	}

	if (query.startsWith('@')) {
		const name = query.slice(1);
		return { users: name || null, tags: null };
	}

	return { users: query || null, tags: query || null };
}

/** The search page address for a query. */
export function searchPath(query: string, tab?: 'posts' | 'people' | 'tags'): string {
	const params = new URLSearchParams({ q: query.trim() });

	if (tab && tab !== 'posts') {
		params.set('tab', tab);
	}

	return `/search?${params.toString()}`;
}
