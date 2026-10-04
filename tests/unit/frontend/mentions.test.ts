import { expect, test } from '@playwright/test';
import {
	applyMention,
	findMentionQuery,
} from '../../../services/frontend-service/src/scripts/mentions';

test.describe('findMentionQuery', () => {
	test('finds the @partial the caret is right after', () => {
		expect(findMentionQuery('hello @al', 9)).toEqual({ start: 6, query: 'al' });
		expect(findMentionQuery('@a', 2)).toEqual({ start: 0, query: 'a' });
	});

	test('finds nothing without a partial name, mid-word, or when the caret moved on', () => {
		expect(findMentionQuery('hello @', 7)).toBeNull();
		expect(findMentionQuery('mail a@b', 8)).toBeNull();
		expect(findMentionQuery('hello @al there', 15)).toBeNull();
	});

	test('looks only at the text before the caret', () => {
		expect(findMentionQuery('hi @al and more', 6)).toEqual({ start: 3, query: 'al' });
	});
});

test.describe('applyMention', () => {
	test('replaces the partial with the full name and a space', () => {
		expect(applyMention('hi @al', 6, 3, 'alice')).toEqual({ text: 'hi @alice ', caret: 10 });
	});

	test('does not add a second space before existing text', () => {
		expect(applyMention('hi @al there', 6, 3, 'alice')).toEqual({
			text: 'hi @alice there',
			caret: 10,
		});
	});
});
