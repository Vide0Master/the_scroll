import { expect, test } from '@playwright/test';
import { generateId } from '../../../services/frontend-service/src/scripts/id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test.describe('generateId', () => {
	test('uses randomUUID when available', () => {
		const id = generateId({
			randomUUID: () => '11111111-1111-4111-8111-111111111111',
			getRandomValues: (array) => array,
		});
		expect(id).toBe('11111111-1111-4111-8111-111111111111');
	});

	test('falls back to getRandomValues on non-secure origins (no randomUUID)', () => {
		const id = generateId({
			getRandomValues: (array) => {
				(array as unknown as Uint8Array).fill(255);
				return array;
			},
		});
		expect(id).toMatch(UUID_V4);
	});

	test('works with the real Web Crypto in Node', () => {
		expect(generateId()).toMatch(UUID_V4);
	});
});
