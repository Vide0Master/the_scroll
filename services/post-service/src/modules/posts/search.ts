import { SEARCH_QUERY_MAX_LENGTH, normalizeHashtag } from '@the-scroll/types';

export interface ParsedSearch {
	/** Words that must appear in the text. */
	terms: string[];
	/** Hashtags the post must carry, normalized. */
	tags: string[];
}

const MAX_TERMS = 8;
const MAX_TAGS = 5;
const MIN_TERM_LENGTH = 2;
const MAX_TERM_LENGTH = 64;

/**
 * Reads a search box query: `#word` asks for a hashtag, anything else is a word to find in the
 * text (all of them, in any order). Returns null when nothing usable is left, e.g. a lone "a".
 */
export function parseSearchQuery(raw: string): ParsedSearch | null {
	if (raw.length > SEARCH_QUERY_MAX_LENGTH) {
		return null;
	}

	const terms = new Set<string>();
	const tags = new Set<string>();

	for (const word of raw.split(/\s+/).filter(Boolean)) {
		if (word.startsWith('#')) {
			const tag = normalizeHashtag(word);

			if (tag) {
				tags.add(tag);
			}
		} else if (word.length >= MIN_TERM_LENGTH && word.length <= MAX_TERM_LENGTH) {
			terms.add(word.toLowerCase());
		}
	}

	if (terms.size === 0 && tags.size === 0) {
		return null;
	}

	return { terms: [...terms].slice(0, MAX_TERMS), tags: [...tags].slice(0, MAX_TAGS) };
}
