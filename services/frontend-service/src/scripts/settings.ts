import { z } from 'zod';
import type { CustomTheme, ThemeColors, UserSettings } from '@the-scroll/types';
import { contrastRatio, isHexColor } from './color';
import type { StorageLike } from './theme';
import { BUILT_IN_THEME_IDS, DEFAULT_THEME_ID } from './themes';

export const MAX_CUSTOM_THEMES = 10;
export const MAX_THEME_NAME_LENGTH = 32;
export const MIN_CONTRAST = 4.5;
export const SETTINGS_STORAGE_KEY = 'scroll.settings';

const hexColor = z.string().refine(isHexColor);

const colorsSchema = z.strictObject({
	background: hexColor,
	panel: hexColor,
	text: hexColor,
	accent: hexColor,
	border: hexColor,
});

const customThemeSchema = z.strictObject({
	id: z.uuid(),
	name: z.string().trim().min(1).max(MAX_THEME_NAME_LENGTH),
	colors: colorsSchema,
});

// Mirrors services/user-service/src/modules/settings/settings.schema.ts: keep both in sync.
export const settingsSchema = z
	.strictObject({
		themeId: z.string().min(1).max(64),
		customThemes: z.array(customThemeSchema).max(MAX_CUSTOM_THEMES),
	})
	.superRefine((value, context) => {
		const ids = value.customThemes.map((theme) => theme.id);
		if (new Set(ids).size !== ids.length) {
			context.addIssue({
				code: 'custom',
				message: 'Custom theme ids must be unique',
				path: ['customThemes'],
			});
		}

		if (
			!BUILT_IN_THEME_IDS.some((id) => id === value.themeId) &&
			!ids.includes(value.themeId)
		) {
			context.addIssue({
				code: 'custom',
				message: 'themeId must be a built-in theme or one of the custom themes',
				path: ['themeId'],
			});
		}
	});

export const DEFAULT_SETTINGS: UserSettings = { themeId: DEFAULT_THEME_ID, customThemes: [] };

export function parseSettings(input: unknown): UserSettings | null {
	const result = settingsSchema.safeParse(input);
	return result.success ? result.data : null;
}

export function isDefaultSettings(settings: UserSettings): boolean {
	return settings.themeId === DEFAULT_THEME_ID && settings.customThemes.length === 0;
}

// After login the account's stored settings always win. Only when the account has nothing stored
// yet are this device's settings adopted (and saved). Stored settings are never overwritten.
export function settingsAfterLogin(
	local: UserSettings,
	server: UserSettings | null,
	isStored: boolean,
): { settings: UserSettings; shouldSave: boolean } {
	if (isStored) {
		return { settings: server ?? local, shouldSave: false };
	}

	return { settings: local, shouldSave: !isDefaultSettings(local) };
}

export function hasLowContrast(colors: ThemeColors): boolean {
	return contrastRatio(colors.text, colors.background) < MIN_CONTRAST;
}

export function withSelectedTheme(settings: UserSettings, themeId: string): UserSettings {
	return { ...settings, themeId };
}

// Adds a new custom theme or replaces the one with the same id; a new theme beyond the limit is
// ignored and the same settings object is returned.
export function withCustomTheme(
	settings: UserSettings,
	theme: CustomTheme,
	select: boolean,
): UserSettings {
	const exists = settings.customThemes.some((item) => item.id === theme.id);

	if (!exists && settings.customThemes.length >= MAX_CUSTOM_THEMES) {
		return settings;
	}

	return {
		themeId: select ? theme.id : settings.themeId,
		customThemes: exists
			? settings.customThemes.map((item) => (item.id === theme.id ? theme : item))
			: [...settings.customThemes, theme],
	};
}

// Removing the selected theme falls back to the default one.
export function withoutCustomTheme(settings: UserSettings, themeId: string): UserSettings {
	return {
		themeId: settings.themeId === themeId ? DEFAULT_THEME_ID : settings.themeId,
		customThemes: settings.customThemes.filter((item) => item.id !== themeId),
	};
}

export function readLocalSettings(storage: StorageLike | null): UserSettings | null {
	if (!storage) {
		return null;
	}

	try {
		const raw = storage.getItem(SETTINGS_STORAGE_KEY);
		return raw ? parseSettings(JSON.parse(raw)) : null;
	} catch {
		return null;
	}
}

export function writeLocalSettings(storage: StorageLike | null, settings: UserSettings): void {
	if (!storage) {
		return;
	}

	try {
		storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
	} catch {
		/* storage is full or blocked: settings are simply not cached */
	}
}
