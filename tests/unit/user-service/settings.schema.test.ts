import { expect, test } from '@playwright/test';
import {
	BUILT_IN_THEME_IDS,
	DEFAULT_SETTINGS,
	settingsSchema,
} from '../../../services/user-service/src/modules/settings/settings.schema';

const colors = {
	background: '#101010',
	panel: '#202020',
	text: '#f0f0f0',
	accent: '#ff0066',
	border: '#303030',
};

function theme(index: number) {
	return {
		id: `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
		name: `Theme ${index}`,
		colors,
	};
}

test.describe('settingsSchema', () => {
	test('knows exactly the built-in ids used by the frontend', () => {
		expect([...BUILT_IN_THEME_IDS].sort()).toEqual([
			'autumn',
			'dark',
			'light',
			'spring',
			'summer',
			'winter',
		]);
	});

	test('accepts the defaults and a built-in themeId', () => {
		expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
		expect(settingsSchema.safeParse({ themeId: 'winter', customThemes: [] }).success).toBe(
			true,
		);
	});

	test('accepts a custom theme selected by id and trims its name', () => {
		const t = { ...theme(1), name: '  Cozy  ' };
		const result = settingsSchema.safeParse({ themeId: t.id, customThemes: [t] });
		expect(result.success).toBe(true);
		expect(result.success && result.data.customThemes[0].name).toBe('Cozy');
	});

	test('accepts exactly 10 custom themes', () => {
		const themes = Array.from({ length: 10 }, (_v, i) => theme(i + 1));
		expect(settingsSchema.safeParse({ themeId: 'dark', customThemes: themes }).success).toBe(
			true,
		);
	});

	for (const [caseName, input] of [
		[
			'non-hex color',
			{
				themeId: 'dark',
				customThemes: [
					{ ...theme(1), colors: { ...colors, accent: 'red;background:url(x)' } },
				],
			},
		],
		[
			'short hex',
			{
				themeId: 'dark',
				customThemes: [{ ...theme(1), colors: { ...colors, accent: '#fff' } }],
			},
		],
		[
			'11 custom themes',
			{ themeId: 'dark', customThemes: Array.from({ length: 11 }, (_v, i) => theme(i + 1)) },
		],
		['duplicate ids', { themeId: 'dark', customThemes: [theme(1), theme(1)] }],
		['unknown themeId', { themeId: 'nope', customThemes: [] }],
		['non-uuid theme id', { themeId: 'dark', customThemes: [{ ...theme(1), id: 'abc' }] }],
		['empty name', { themeId: 'dark', customThemes: [{ ...theme(1), name: '   ' }] }],
		[
			'33-char name',
			{ themeId: 'dark', customThemes: [{ ...theme(1), name: 'x'.repeat(33) }] },
		],
		['extra top-level field', { themeId: 'dark', customThemes: [], admin: true }],
		[
			'extra color field',
			{
				themeId: 'dark',
				customThemes: [{ ...theme(1), colors: { ...colors, extra: '#000000' } }],
			},
		],
		['missing customThemes', { themeId: 'dark' }],
		['not an object', 'dark'],
		['null', null],
	]) {
		test(`rejects ${caseName}`, () => {
			expect(settingsSchema.safeParse(input).success).toBe(false);
		});
	}
});
