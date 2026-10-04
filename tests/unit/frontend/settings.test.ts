import { expect, test } from '@playwright/test';
import type { CustomTheme } from '@the-scroll/types';
import {
	DEFAULT_SETTINGS,
	SETTINGS_STORAGE_KEY,
	hasLowContrast,
	isDefaultSettings,
	parseSettings,
	readLocalSettings,
	settingsAfterLogin,
	withCustomTheme,
	withSelectedTheme,
	withoutCustomTheme,
	writeLocalSettings,
} from '../../../services/frontend-service/src/scripts/settings';
import type { StorageLike } from '../../../services/frontend-service/src/scripts/theme';

const colors = {
	background: '#101010',
	panel: '#202020',
	text: '#f0f0f0',
	accent: '#ff0066',
	border: '#303030',
};

function theme(index: number): CustomTheme {
	const id = `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`;
	return { id, name: `Theme ${index}`, colors };
}

function fakeStorage(initial: Record<string, string> = {}): StorageLike {
	const data = { ...initial };
	return {
		getItem: (key) => (key in data ? data[key] : null),
		setItem: (key, value) => {
			data[key] = value;
		},
	};
}

test.describe('parseSettings', () => {
	test('accepts the default settings and a built-in themeId', () => {
		expect(parseSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
		expect(parseSettings({ themeId: 'winter', customThemes: [] })).not.toBeNull();
	});

	test('accepts a custom theme selected by id', () => {
		const t = theme(1);
		expect(parseSettings({ themeId: t.id, customThemes: [t] })).toEqual({
			themeId: t.id,
			customThemes: [t],
		});
	});

	test('trims the theme name', () => {
		const t = { ...theme(1), name: '  Cozy  ' };
		expect(parseSettings({ themeId: t.id, customThemes: [t] })?.customThemes[0].name).toBe(
			'Cozy',
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
		['not an object', 'dark'],
		['null', null],
	]) {
		test(`rejects ${caseName}`, () => {
			expect(parseSettings(input)).toBeNull();
		});
	}

	test('accepts exactly 10 custom themes', () => {
		const themes = Array.from({ length: 10 }, (_v, i) => theme(i + 1));
		expect(parseSettings({ themeId: 'dark', customThemes: themes })).not.toBeNull();
	});
});

test.describe('hasLowContrast', () => {
	test('flags text that is nearly the background color', () => {
		expect(hasLowContrast({ ...colors, text: '#111111' })).toBe(true);
	});

	test('does not flag a readable pair', () => {
		expect(hasLowContrast(colors)).toBe(false);
	});
});

test.describe('local settings storage', () => {
	test('round-trips valid settings', () => {
		const storage = fakeStorage();
		const settings = { themeId: 'autumn', customThemes: [] };
		writeLocalSettings(storage, settings);
		expect(readLocalSettings(storage)).toEqual(settings);
	});

	test('returns null for missing storage, empty storage, invalid JSON and invalid data', () => {
		expect(readLocalSettings(null)).toBeNull();
		expect(readLocalSettings(fakeStorage())).toBeNull();
		expect(readLocalSettings(fakeStorage({ [SETTINGS_STORAGE_KEY]: '{bad' }))).toBeNull();
		expect(
			readLocalSettings(
				fakeStorage({
					[SETTINGS_STORAGE_KEY]: JSON.stringify({ themeId: 'nope', customThemes: [] }),
				}),
			),
		).toBeNull();
	});

	test('never throws when storage is blocked', () => {
		const blocked: StorageLike = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			},
		};
		expect(readLocalSettings(blocked)).toBeNull();
		expect(() => writeLocalSettings(blocked, DEFAULT_SETTINGS)).not.toThrow();
	});
});

test.describe('theme list operations', () => {
	const base = { themeId: 'dark', customThemes: [theme(1)] };

	test('withSelectedTheme changes only the themeId', () => {
		expect(withSelectedTheme(base, 'winter')).toEqual({ ...base, themeId: 'winter' });
	});

	test('withCustomTheme appends a new theme and selects it on request', () => {
		const added = withCustomTheme(base, theme(2), true);
		expect(added.customThemes.map((item) => item.id)).toEqual([theme(1).id, theme(2).id]);
		expect(added.themeId).toBe(theme(2).id);
		expect(withCustomTheme(base, theme(2), false).themeId).toBe('dark');
	});

	test('withCustomTheme replaces an existing theme in place', () => {
		const renamed = { ...theme(1), name: 'Renamed' };
		const result = withCustomTheme(base, renamed, false);
		expect(result.customThemes).toEqual([renamed]);
	});

	test('withCustomTheme ignores a new theme beyond the limit but still allows edits', () => {
		const full = {
			themeId: 'dark',
			customThemes: Array.from({ length: 10 }, (_v, i) => theme(i + 1)),
		};
		expect(withCustomTheme(full, theme(11), true)).toBe(full);
		const renamed = { ...theme(3), name: 'Renamed' };
		expect(withCustomTheme(full, renamed, false).customThemes[2]).toEqual(renamed);
	});

	test('withoutCustomTheme removes the theme and falls back to dark when it was selected', () => {
		const selected = { themeId: theme(1).id, customThemes: [theme(1), theme(2)] };
		expect(withoutCustomTheme(selected, theme(1).id)).toEqual({
			themeId: 'dark',
			customThemes: [theme(2)],
		});
	});

	test('withoutCustomTheme keeps the selection when another theme is removed', () => {
		const selected = { themeId: theme(2).id, customThemes: [theme(1), theme(2)] };
		expect(withoutCustomTheme(selected, theme(1).id)).toEqual({
			themeId: theme(2).id,
			customThemes: [theme(2)],
		});
	});
});

test.describe('isDefaultSettings', () => {
	test('is true only for dark with no custom themes', () => {
		expect(isDefaultSettings(DEFAULT_SETTINGS)).toBe(true);
		expect(isDefaultSettings({ themeId: 'winter', customThemes: [] })).toBe(false);
		expect(isDefaultSettings({ themeId: 'dark', customThemes: [theme(1)] })).toBe(false);
	});
});

test.describe('settingsAfterLogin', () => {
	const stored = { themeId: theme(1).id, customThemes: [theme(1), theme(2)] };
	const local = { themeId: 'winter', customThemes: [] };

	test('lets stored account settings win over local ones and never saves over them', () => {
		expect(settingsAfterLogin(local, stored, true)).toEqual({
			settings: stored,
			shouldSave: false,
		});
	});

	test('keeps local settings but does not overwrite the account when the stored data is unusable', () => {
		expect(settingsAfterLogin(local, null, true)).toEqual({
			settings: local,
			shouldSave: false,
		});
	});

	test('adopts non-default local settings when the account has nothing stored and asks to save', () => {
		expect(settingsAfterLogin(local, DEFAULT_SETTINGS, false)).toEqual({
			settings: local,
			shouldSave: true,
		});
	});

	test('does not save default local settings for an empty account', () => {
		expect(settingsAfterLogin(DEFAULT_SETTINGS, DEFAULT_SETTINGS, false)).toEqual({
			settings: DEFAULT_SETTINGS,
			shouldSave: false,
		});
	});
});
