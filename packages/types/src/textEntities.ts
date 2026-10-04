// Hashtags and @mentions in post text. Shared by post-service (which indexes them when a post
// is saved) and the frontend (which highlights and links them), so both read the text the same
// way. Letters and digits of any script plus "_" form a name; anything else ends it.

export const HASHTAG_MAX_LENGTH = 50;
export const MENTION_MIN_LENGTH = 3;
export const MENTION_MAX_LENGTH = 32;
/** Only this many distinct tags/mentions of one post are indexed; the rest stay plain text. */
export const POST_TAGS_MAX = 30;
export const POST_MENTIONS_MAX = 20;

export type TextSegment =
	| { type: 'text'; value: string }
	| { type: 'hashtag'; value: string }
	| { type: 'mention'; value: string };

// Not preceded by a name character or by "/", "&", "#", "@": that keeps URL fragments
// (page/#part), HTML entities and e-mail addresses (a@b.c) from being read as entities.
const ENTITY_PATTERN = /(?<![\p{L}\p{N}_/&#@])([#@])([\p{L}\p{N}_]+)/gu;

function isTag(name: string): boolean {
	// Digits only ("#1") is a number, not a tag.
	return name.length <= HASHTAG_MAX_LENGTH && !/^\p{N}+$/u.test(name);
}

function isUserName(name: string): boolean {
	return name.length >= MENTION_MIN_LENGTH && name.length <= MENTION_MAX_LENGTH;
}

/** Splits text into plain, hashtag and mention parts; joining every `value` (with its `#`/`@`) gives the text back. */
export function splitTextEntities(text: string): TextSegment[] {
	const segments: TextSegment[] = [];
	let cursor = 0;

	for (const match of text.matchAll(ENTITY_PATTERN)) {
		const [whole, marker, name] = match;
		const isHashtag = marker === '#';

		if (isHashtag ? !isTag(name) : !isUserName(name)) {
			continue;
		}

		if (match.index > cursor) {
			segments.push({ type: 'text', value: text.slice(cursor, match.index) });
		}

		segments.push({ type: isHashtag ? 'hashtag' : 'mention', value: name });
		cursor = match.index + whole.length;
	}

	if (cursor < text.length) {
		segments.push({ type: 'text', value: text.slice(cursor) });
	}

	return segments;
}

/** Distinct hashtags of a text, lowercased (tags are case-insensitive), in order of appearance. */
export function extractHashtags(text: string): string[] {
	const tags = splitTextEntities(text)
		.filter((segment) => segment.type === 'hashtag')
		.map((segment) => segment.value.toLowerCase());

	return [...new Set(tags)].slice(0, POST_TAGS_MAX);
}

/** Distinct @names of a text as written; whether each is a real account is for the server to say. */
export function extractMentions(text: string): string[] {
	const names = splitTextEntities(text)
		.filter((segment) => segment.type === 'mention')
		.map((segment) => segment.value);

	return [...new Set(names)].slice(0, POST_MENTIONS_MAX);
}

/** The form a tag is stored and searched in. */
export function normalizeHashtag(tag: string): string | null {
	const name = tag.replace(/^#/, '').toLowerCase();
	return /^[\p{L}\p{N}_]+$/u.test(name) && isTag(name) ? name : null;
}
