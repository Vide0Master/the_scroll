import { expect, test } from '@playwright/test';
import {
	dominantColors,
	gradientCss,
	gradientOptions,
} from '../../../services/frontend-service/src/scripts/palette';

function pixels(...blocks: [number, number, number, number, number][]): number[] {
	// Each block is [r, g, b, a, count].
	return blocks.flatMap(([r, g, b, a, count]) =>
		Array.from({ length: count }, () => [r, g, b, a]).flat(),
	);
}

test.describe('dominantColors', () => {
	test('returns the most frequent colors first', () => {
		const data = pixels([200, 0, 0, 255, 30], [0, 0, 200, 255, 10]);

		expect(dominantColors(data, 2)).toEqual(['#c80000', '#0000c8']);
	});

	test('ignores transparent pixels, so a cut-out avatar yields only its subject', () => {
		const data = pixels([0, 0, 0, 0, 500], [10, 200, 10, 255, 5]);

		expect(dominantColors(data, 3)).toEqual(['#0ac80a']);
	});

	test('is empty for a fully transparent image', () => {
		expect(dominantColors(pixels([255, 255, 255, 0, 100]), 3)).toEqual([]);
	});

	test('does not return several shades of the same color', () => {
		const data = pixels([200, 0, 0, 255, 30], [205, 5, 0, 255, 20], [0, 0, 200, 255, 5]);

		expect(dominantColors(data, 3)).toHaveLength(2);
	});

	test('respects the requested count', () => {
		const data = pixels([250, 0, 0, 255, 9], [0, 250, 0, 255, 8], [0, 0, 250, 255, 7]);

		expect(dominantColors(data, 2)).toHaveLength(2);
	});
});

test.describe('gradientOptions', () => {
	test('has nothing to offer without colors', () => {
		expect(gradientOptions([])).toEqual([]);
	});

	test('builds shades from a single color', () => {
		const options = gradientOptions(['#c80000']);

		expect(options).toHaveLength(2);
		expect(
			options.every(
				(option) => /^#[0-9a-f]{6}$/.test(option.from) && /^#[0-9a-f]{6}$/.test(option.to),
			),
		).toBe(true);
		expect(options.some((option) => option.from === '#c80000' || option.to === '#c80000')).toBe(
			true,
		);
	});

	test('pairs up several colors, at most four options', () => {
		const options = gradientOptions(['#c80000', '#00c800', '#0000c8', '#c8c800']);

		expect(options).toHaveLength(4);
		expect(options[0]).toEqual({ from: '#c80000', to: '#00c800' });
		expect(new Set(options.map((option) => option.from + option.to)).size).toBe(4);
	});
});

test('gradientCss produces a diagonal linear gradient', () => {
	expect(gradientCss({ from: '#111111', to: '#222222' })).toBe(
		'linear-gradient(135deg, #111111, #222222)',
	);
});
