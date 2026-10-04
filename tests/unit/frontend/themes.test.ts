import { expect, test } from '@playwright/test';
import type { CustomTheme } from '@the-scroll/types';
import { contrastRatio, isHexColor } from '../../../services/frontend-service/src/scripts/color';
import {
	BUILT_IN_THEMES,
	BUILT_IN_THEME_IDS,
	DEFAULT_THEME_ID,
	isBuiltInThemeId,
	resolveThemeColors,
} from '../../../services/frontend-service/src/scripts/themes';

const custom: CustomTheme = {
	id: '11111111-1111-4111-8111-111111111111',
	name: 'Mine',
	colors: {
		background: '#101010',
		panel: '#202020',
		text: '#f0f0f0',
		accent: '#ff0066',
		border: '#303030',
	},
};

test.describe('built-in themes', () => {
	test('are exactly the six themes from the spec, dark being the default', () => {
		expect([...BUILT_IN_THEME_IDS].sort()).toEqual([
			'autumn',
			'dark',
			'light',
			'spring',
			'summer',
			'winter',
		]);
		expect(DEFAULT_THEME_ID).toBe('dark');
	});

	for (const id of BUILT_IN_THEME_IDS) {
		test(`${id} uses only valid hex colors`, () => {
			for (const color of Object.values(BUILT_IN_THEMES[id])) {
				expect(isHexColor(color)).toBe(true);
			}
		});
	}

	for (const id of BUILT_IN_THEME_IDS) {
		test(`${id} has readable text on background and panel`, () => {
			const { text, background, panel } = BUILT_IN_THEMES[id];
			expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(text, panel)).toBeGreaterThanOrEqual(4.5);
		});
	}
});

test.describe('isBuiltInThemeId', () => {
	test('is true for built-in ids and false for anything else, incl. object prototype keys', () => {
		expect(isBuiltInThemeId('winter')).toBe(true);
		expect(isBuiltInThemeId(custom.id)).toBe(false);
		expect(isBuiltInThemeId('toString')).toBe(false);
		expect(isBuiltInThemeId('__proto__')).toBe(false);
	});
});

test.describe('resolveThemeColors', () => {
	test('resolves a built-in id', () => {
		expect(resolveThemeColors('light', [])).toEqual({
			id: 'light',
			colors: BUILT_IN_THEMES.light,
		});
	});

	test('resolves a custom theme id', () => {
		expect(resolveThemeColors(custom.id, [custom])).toEqual({
			id: custom.id,
			colors: custom.colors,
		});
	});

	test('falls back to dark for an unknown or deleted theme id', () => {
		expect(resolveThemeColors('deleted-theme', [custom])).toEqual({
			id: 'dark',
			colors: BUILT_IN_THEMES.dark,
		});
		expect(resolveThemeColors('', [])).toEqual({ id: 'dark', colors: BUILT_IN_THEMES.dark });
	});
});
