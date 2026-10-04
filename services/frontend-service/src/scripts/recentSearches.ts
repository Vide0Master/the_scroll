import { readJSON, removeItem, writeJSON } from './storage';

const KEY = 'search:recent';
export const MAX_RECENT_SEARCHES = 8;

const isStringList = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every((item) => typeof item === 'string');

/** `query` moved to the front of `list` (no repeats, case aside), the list kept short. */
export function withRecentSearch(list: string[], query: string): string[] {
	const text = query.trim();

	if (!text) {
		return list;
	}

	return [text, ...list.filter((item) => item.toLowerCase() !== text.toLowerCase())].slice(
		0,
		MAX_RECENT_SEARCHES,
	);
}

export const readRecentSearches = (): string[] => readJSON(KEY, [], isStringList);

/** Remembers a search that was run; returns the new list. */
export function rememberSearch(query: string): string[] {
	const next = withRecentSearch(readRecentSearches(), query);
	writeJSON(KEY, next);
	return next;
}

export const clearRecentSearches = () => removeItem(KEY);
