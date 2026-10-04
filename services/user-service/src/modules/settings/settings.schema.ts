import { z } from 'zod';
import type { UserSettings } from '@the-scroll/types';

// Keep in sync with BUILT_IN_THEMES in services/frontend-service/src/scripts/themes.ts.
export const BUILT_IN_THEME_IDS = ['dark', 'light', 'autumn', 'winter', 'spring', 'summer'];

export const MAX_CUSTOM_THEMES = 10;
export const MAX_THEME_NAME_LENGTH = 32;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

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

// Mirrors services/frontend-service/src/scripts/settings.ts: keep both in sync.
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

		if (!BUILT_IN_THEME_IDS.includes(value.themeId) && !ids.includes(value.themeId)) {
			context.addIssue({
				code: 'custom',
				message: 'themeId must be a built-in theme or one of the custom themes',
				path: ['themeId'],
			});
		}
	});

export const DEFAULT_SETTINGS: UserSettings = { themeId: 'dark', customThemes: [] };
