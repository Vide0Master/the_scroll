import { expect, test } from '@playwright/test';
import {
	THEME_CACHE_KEY,
	applyTheme,
	applyThemeVars,
	readThemeCache,
	themeToCssVars,
	writeThemeCache,
	type StorageLike,
} from '../../../services/frontend-service/src/scripts/theme';
import { BUILT_IN_THEMES } from '../../../services/frontend-service/src/scripts/themes';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & {
	data: Record<string, string>;
} {
	const data = { ...initial };
	return {
		data,
		getItem: (key) => (key in data ? data[key] : null),
		setItem: (key, value) => {
			data[key] = value;
		},
	};
}

const throwingStorage: StorageLike = {
	getItem: () => {
		throw new Error('blocked');
	},
	setItem: () => {
		throw new Error('blocked');
	},
};

test.describe('themeToCssVars', () => {
	test('maps the five colors and adds a computed on-accent', () => {
		const vars = themeToCssVars(BUILT_IN_THEMES.dark);
		expect(vars).toEqual([
			['--theme-surface', '#0b0f14'],
			['--theme-panel', '#16181c'],
			['--theme-main', '#e7e9ea'],
			['--theme-line', '#2f3336'],
			['--theme-accent', '#1d9bf0'],
			['--theme-on-accent', '#000000'],
		]);
	});
});

test.describe('applyThemeVars', () => {
	test('sets every variable on the target', () => {
		const calls: [string, string][] = [];
		const setProperty = (name: string, value: string) => calls.push([name, value]);
		applyThemeVars(themeToCssVars(BUILT_IN_THEMES.light), { style: { setProperty } });
		expect(calls).toHaveLength(6);
		expect(calls).toContainEqual(['--theme-surface', '#ffffff']);
	});
});

test.describe('theme cache', () => {
	test('round-trips through storage', () => {
		const storage = fakeStorage();
		const vars = themeToCssVars(BUILT_IN_THEMES.autumn);
		writeThemeCache(storage, 'autumn', vars);
		expect(readThemeCache(storage)).toEqual({ v: 1, themeId: 'autumn', vars });
	});

	test('returns null when storage is missing, throws, or is empty', () => {
		expect(readThemeCache(null)).toBeNull();
		expect(readThemeCache(throwingStorage)).toBeNull();
		expect(readThemeCache(fakeStorage())).toBeNull();
	});

	test('does not throw when writing to missing or blocked storage', () => {
		const vars = themeToCssVars(BUILT_IN_THEMES.dark);
		expect(() => writeThemeCache(null, 'dark', vars)).not.toThrow();
		expect(() => writeThemeCache(throwingStorage, 'dark', vars)).not.toThrow();
	});

	for (const [caseName, raw] of [
		['invalid JSON', '{nope'],
		['wrong version', JSON.stringify({ v: 2, themeId: 'dark', vars: [] })],
		['wrong shape', JSON.stringify({ v: 1, themeId: 5, vars: 'x' })],
		[
			'a variable outside the --theme- namespace',
			JSON.stringify({ v: 1, themeId: 'dark', vars: [['--evil', '#000000']] }),
		],
		[
			'a non-hex value',
			JSON.stringify({
				v: 1,
				themeId: 'dark',
				vars: [['--theme-surface', 'red;background:url(x)']],
			}),
		],
	]) {
		test(`rejects a tampered cache: ${caseName}`, () => {
			expect(readThemeCache(fakeStorage({ [THEME_CACHE_KEY]: raw }))).toBeNull();
		});
	}
});

test.describe('applyTheme', () => {
	test('applies the variables and writes the cache', () => {
		const storage = fakeStorage();
		const calls: [string, string][] = [];
		const setProperty = (name: string, value: string) => calls.push([name, value]);
		applyTheme('winter', BUILT_IN_THEMES.winter, storage, { style: { setProperty } });
		expect(calls).toContainEqual(['--theme-accent', '#2f7fc1']);
		expect(readThemeCache(storage)?.themeId).toBe('winter');
	});
});
