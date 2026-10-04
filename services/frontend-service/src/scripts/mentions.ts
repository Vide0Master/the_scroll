// The "@partial" being typed at the caret, and inserting a picked username in its place.

// Same name characters and boundary as `splitTextEntities` in @the-scroll/types.
const MENTION_QUERY = /(?<![\p{L}\p{N}_/&#@])@([\p{L}\p{N}_]{1,32})$/u;

export interface MentionQuery {
	/** Index of the "@" in the text. */
	start: number;
	/** What was typed after the "@". */
	query: string;
}

/** The @name the caret is at the end of, or null when the caret is not right after one. */
export function findMentionQuery(text: string, caret: number): MentionQuery | null {
	const match = MENTION_QUERY.exec(text.slice(0, caret));
	return match ? { start: match.index, query: match[1] } : null;
}

/** Replaces the typed "@partial" with the full "@userName" and a space; returns the new caret too. */
export function applyMention(
	text: string,
	caret: number,
	start: number,
	userName: string,
): { text: string; caret: number } {
	const after = text.slice(caret);
	const insertion = `@${userName}${/^\s/.test(after) ? '' : ' '}`;
	const next = text.slice(0, start) + insertion + after;

	return { text: next, caret: start + insertion.length + (/^\s/.test(after) ? 1 : 0) };
}
