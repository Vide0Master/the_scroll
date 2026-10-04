import { expect, test } from '@playwright/test';
import { parseSearchQuery } from '../../../services/post-service/src/modules/posts/search';

test.describe('parseSearchQuery', () => {
	test('splits words and hashtags, lowercased and unique', () => {
		expect(parseSearchQuery('Coffee  #Kava  coffee shops #kava')).toEqual({
			terms: ['coffee', 'shops'],
			tags: ['kava'],
		});
	});

	test('a query of only hashtags or only words is fine', () => {
		expect(parseSearchQuery('#a1')).toEqual({ terms: [], tags: ['a1'] });
		expect(parseSearchQuery('hello')).toEqual({ terms: ['hello'], tags: [] });
	});

	test('drops one-letter words and malformed tags; nothing left means no search', () => {
		expect(parseSearchQuery('a b c')).toBeNull();
		expect(parseSearchQuery('# #123 #a-b')).toBeNull();
		expect(parseSearchQuery('   ')).toBeNull();
		expect(parseSearchQuery('a hello')).toEqual({ terms: ['hello'], tags: [] });
	});

	test('limits the size of the query and the number of words', () => {
		expect(parseSearchQuery('x'.repeat(101))).toBeNull();
		const many = Array.from({ length: 12 }, (_, index) => `word${index}`).join(' ');
		expect(parseSearchQuery(many)?.terms).toHaveLength(8);
		expect(parseSearchQuery('x'.repeat(65))).toBeNull();
	});
});
