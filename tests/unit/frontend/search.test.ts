import { expect, test } from '@playwright/test';
import { searchPath, suggestionQuery } from '../../../services/frontend-service/src/scripts/search';

test.describe('suggestionQuery', () => {
	test('plain text asks for people and hashtags', () => {
		expect(suggestionQuery('  ann ')).toEqual({ users: 'ann', tags: 'ann' });
	});

	test('"#" asks for hashtags only and "@" for people only', () => {
		expect(suggestionQuery('#kav')).toEqual({ users: null, tags: 'kav' });
		expect(suggestionQuery('@ann')).toEqual({ users: 'ann', tags: null });
	});

	test('a bare mark or nothing asks for nothing', () => {
		expect(suggestionQuery('#')).toEqual({ users: null, tags: null });
		expect(suggestionQuery('@')).toEqual({ users: null, tags: null });
		expect(suggestionQuery('   ')).toEqual({ users: null, tags: null });
	});
});

test.describe('searchPath', () => {
	test('encodes the query and only names a tab other than posts', () => {
		expect(searchPath(' a b&c ')).toBe('/search?q=a+b%26c');
		expect(searchPath('kava', 'tags')).toBe('/search?q=kava&tab=tags');
		expect(searchPath('kava', 'posts')).toBe('/search?q=kava');
	});
});
