import { expect, test } from '@playwright/test';
import { postPath, profilePath } from '../../../services/frontend-service/src/scripts/routes';

test.describe('profilePath', () => {
	test('builds /u/<name>', () => {
		expect(profilePath('alice')).toBe('/u/alice');
	});

	test('encodes characters that would otherwise break or redirect the URL', () => {
		expect(profilePath('a b/c?d#e')).toBe('/u/a%20b%2Fc%3Fd%23e');
		expect(profilePath('../settings')).toBe('/u/..%2Fsettings');
	});
});

test.describe('postPath', () => {
	test('builds /post/<id>', () => {
		expect(postPath('0470ac2a-32fb-4160-b68e-24a16f4ec69e')).toBe(
			'/post/0470ac2a-32fb-4160-b68e-24a16f4ec69e',
		);
	});

	test('encodes characters that would otherwise break or redirect the URL', () => {
		expect(postPath('a b/c?d#e')).toBe('/post/a%20b%2Fc%3Fd%23e');
	});
});
