import type { CustomTheme, ThemeColors } from '@the-scroll/types';

// Keep the id list in sync with BUILT_IN_THEME_IDS in
// services/user-service/src/modules/settings/settings.schema.ts.
export const BUILT_IN_THEMES = {
	dark: {
		background: '#0b0f14',
		panel: '#16181c',
		text: '#e7e9ea',
		accent: '#1d9bf0',
		border: '#2f3336',
	},
	light: {
		background: '#ffffff',
		panel: '#f7f9f9',
		text: '#0f1419',
		accent: '#1d9bf0',
		border: '#eff3f4',
	},
	autumn: {
		background: '#1c1410',
		panel: '#2a1d16',
		text: '#f3e5d8',
		accent: '#e07a2f',
		border: '#4a3428',
	},
	winter: {
		background: '#eef4fa',
		panel: '#ffffff',
		text: '#14202e',
		accent: '#2f7fc1',
		border: '#cfdce9',
	},
	spring: {
		background: '#f3faf0',
		panel: '#ffffff',
		text: '#1b2a1a',
		accent: '#3fa34d',
		border: '#d3e8cc',
	},
	summer: {
		background: '#fff9e8',
		panel: '#ffffff',
		text: '#2b2100',
		accent: '#f0a500',
		border: '#f0e2b6',
	},
} satisfies Record<string, ThemeColors>;

export type BuiltInThemeId = keyof typeof BUILT_IN_THEMES;

export const BUILT_IN_THEME_IDS = Object.keys(BUILT_IN_THEMES) as BuiltInThemeId[];

export const DEFAULT_THEME_ID: BuiltInThemeId = 'dark';

export function isBuiltInThemeId(id: string): id is BuiltInThemeId {
	return Object.hasOwn(BUILT_IN_THEMES, id);
}

export function resolveThemeColors(
	themeId: string,
	customThemes: CustomTheme[],
): { id: string; colors: ThemeColors } {
	if (isBuiltInThemeId(themeId)) {
		return { id: themeId, colors: BUILT_IN_THEMES[themeId] };
	}

	const found = customThemes.find((theme) => theme.id === themeId);
	if (found) {
		return { id: found.id, colors: found.colors };
	}

	return { id: DEFAULT_THEME_ID, colors: BUILT_IN_THEMES[DEFAULT_THEME_ID] };
}
