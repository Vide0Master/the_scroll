import { expect, test } from '@playwright/test';
import { escapeLike } from '../../../packages/backend-core/src/db';

test.describe('escapeLike', () => {
	test('escapes the LIKE wildcards and the escape character itself', () => {
		expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
	});

	test('leaves ordinary text alone', () => {
		expect(escapeLike('coffee shop #1')).toBe('coffee shop #1');
	});
});
