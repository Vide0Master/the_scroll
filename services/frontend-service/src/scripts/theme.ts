import type { ThemeColors } from '@the-scroll/types';
import { isHexColor, pickOnAccent } from './color';
import { getBrowserStorage } from './storage';

export type CssVar = [name: string, value: string];

export interface StyleTarget {
	style: { setProperty(name: string, value: string): void };
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export interface CachedTheme {
	v: 1;
	themeId: string;
	vars: CssVar[];
}

export const THEME_CACHE_KEY = 'scroll.theme';

export function themeToCssVars(colors: ThemeColors): CssVar[] {
	return [
		['--theme-surface', colors.background],
		['--theme-panel', colors.panel],
		['--theme-main', colors.text],
		['--theme-line', colors.border],
		['--theme-accent', colors.accent],
		['--theme-on-accent', pickOnAccent(colors.accent)],
	];
}

export function applyThemeVars(vars: CssVar[], root: StyleTarget = document.documentElement): void {
	for (const [name, value] of vars) {
		root.style.setProperty(name, value);
	}
}

function isCssVar(entry: unknown): entry is CssVar {
	return (
		Array.isArray(entry) &&
		entry.length === 2 &&
		typeof entry[0] === 'string' &&
		typeof entry[1] === 'string' &&
		/^--theme-[a-z-]+$/.test(entry[0]) &&
		isHexColor(entry[1])
	);
}

export function readThemeCache(storage: StorageLike | null): CachedTheme | null {
	if (!storage) {
		return null;
	}

	try {
		const raw = storage.getItem(THEME_CACHE_KEY);
		if (!raw) {
			return null;
		}

		const parsed: unknown = JSON.parse(raw);
		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			(parsed as { v?: unknown }).v !== 1 ||
			typeof (parsed as { themeId?: unknown }).themeId !== 'string'
		) {
			return null;
		}

		const vars = (parsed as { vars?: unknown }).vars;
		if (!Array.isArray(vars) || !vars.every(isCssVar)) {
			return null;
		}

		return { v: 1, themeId: (parsed as { themeId: string }).themeId, vars };
	} catch {
		return null;
	}
}

export function writeThemeCache(
	storage: StorageLike | null,
	themeId: string,
	vars: CssVar[],
): void {
	if (!storage) {
		return;
	}

	try {
		const cached: CachedTheme = { v: 1, themeId, vars };
		storage.setItem(THEME_CACHE_KEY, JSON.stringify(cached));
	} catch {
		/* storage is full or blocked: the theme simply is not cached */
	}
}

export { getBrowserStorage };

export function applyTheme(
	themeId: string,
	colors: ThemeColors,
	storage: StorageLike | null = getBrowserStorage(),
	root?: StyleTarget,
): void {
	const vars = themeToCssVars(colors);
	applyThemeVars(vars, root);
	writeThemeCache(storage, themeId, vars);
}
