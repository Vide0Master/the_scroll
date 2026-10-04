import type { CustomTheme, UserSettings } from '@the-scroll/types';
import type { Prisma } from '../../../prisma/generated/prisma/client';
import { prisma } from '../../lib/prisma';

export async function getStoredSettings(userID: string): Promise<UserSettings | null> {
	const row = await prisma.userSettings.findUnique({ where: { userID } });

	if (!row) {
		return null;
	}

	return {
		themeId: row.themeId,
		customThemes: row.customThemes as unknown as CustomTheme[],
	};
}

export async function saveSettings(userID: string, settings: UserSettings): Promise<void> {
	const customThemes = settings.customThemes as unknown as Prisma.InputJsonArray;

	await prisma.userSettings.upsert({
		where: { userID },
		create: { userID, themeId: settings.themeId, customThemes },
		update: { themeId: settings.themeId, customThemes },
	});
}
