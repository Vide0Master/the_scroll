import { expect, test } from '@playwright/test';
import {
	extractHashtags,
	extractMentions,
	normalizeHashtag,
	splitTextEntities,
} from '../../../packages/types/src/textEntities';

test.describe('splitTextEntities', () => {
	test('separates plain text, hashtags and mentions and loses nothing', () => {
		const text = 'hi @alice_1, see #Coffee and #кава!';
		const segments = splitTextEntities(text);

		expect(segments).toEqual([
			{ type: 'text', value: 'hi ' },
			{ type: 'mention', value: 'alice_1' },
			{ type: 'text', value: ', see ' },
			{ type: 'hashtag', value: 'Coffee' },
			{ type: 'text', value: ' and ' },
			{ type: 'hashtag', value: 'кава' },
			{ type: 'text', value: '!' },
		]);
	});

	test('ignores marks glued to a word, URL fragments and e-mail addresses', () => {
		expect(splitTextEntities('a#b')).toEqual([{ type: 'text', value: 'a#b' }]);
		expect(splitTextEntities('https://x.test/#part')).toEqual([
			{ type: 'text', value: 'https://x.test/#part' },
		]);
		expect(splitTextEntities('write to bob@site.test')).toEqual([
			{ type: 'text', value: 'write to bob@site.test' },
		]);
	});

	test('a number is not a hashtag and a too short or too long @name is not a mention', () => {
		expect(extractHashtags('#123 #12a')).toEqual(['12a']);
		expect(extractMentions('@ab @abc')).toEqual(['abc']);
		expect(extractMentions(`@${'x'.repeat(33)}`)).toEqual([]);
		expect(extractHashtags(`#${'x'.repeat(51)}`)).toEqual([]);
	});
});

test.describe('extractHashtags and extractMentions', () => {
	test('tags are lowercased and unique, mentions keep their case and are unique', () => {
		expect(extractHashtags('#Tag #tag #TAG #other')).toEqual(['tag', 'other']);
		expect(extractMentions('@Alice @Alice @bob123')).toEqual(['Alice', 'bob123']);
	});
});

test.describe('normalizeHashtag', () => {
	test('accepts a tag with or without "#" and rejects anything that is not one', () => {
		expect(normalizeHashtag('#Кава')).toBe('кава');
		expect(normalizeHashtag('tag_1')).toBe('tag_1');
		expect(normalizeHashtag('a b')).toBeNull();
		expect(normalizeHashtag('123')).toBeNull();
		expect(normalizeHashtag('')).toBeNull();
	});
});
