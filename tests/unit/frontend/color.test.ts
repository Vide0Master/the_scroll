import { expect, test } from '@playwright/test';
import {
	contrastRatio,
	hexToRgb,
	isHexColor,
	pickOnAccent,
} from '../../../services/frontend-service/src/scripts/color';

test.describe('isHexColor', () => {
	test('accepts #rrggbb in any case', () => {
		expect(isHexColor('#0b0f14')).toBe(true);
		expect(isHexColor('#ABCDEF')).toBe(true);
	});

	test('rejects everything else, including CSS injection attempts', () => {
		const bad = [
			'',
			'#fff',
			'0b0f14',
			'#0b0f1',
			'#0b0f14ff',
			'red',
			'#0b0f14;background:red',
			'#gggggg',
		];
		for (const value of bad) {
			expect(isHexColor(value)).toBe(false);
		}
	});
});

test.describe('hexToRgb', () => {
	test('parses channels', () => {
		expect(hexToRgb('#ff8000')).toEqual([255, 128, 0]);
		expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
	});
});

test.describe('contrastRatio', () => {
	test('is 21 for black on white, in both directions', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
		expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
	});

	test('is 1 for identical colors', () => {
		expect(contrastRatio('#1d9bf0', '#1d9bf0')).toBeCloseTo(1, 5);
	});
});

test.describe('pickOnAccent', () => {
	test('picks black on a white accent and white on a black accent', () => {
		expect(pickOnAccent('#ffffff')).toBe('#000000');
		expect(pickOnAccent('#000000')).toBe('#ffffff');
	});

	test('picks the higher-contrast color for a mid-tone accent', () => {
		// #1d9bf0 has contrast 7.0 with black and 3.0 with white
		expect(pickOnAccent('#1d9bf0')).toBe('#000000');
	});
});
