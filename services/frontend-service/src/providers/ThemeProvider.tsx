import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { CustomTheme, UserSettings } from '@the-scroll/types';
import { api } from '../scripts/api';
import {
	DEFAULT_SETTINGS,
	parseSettings,
	readLocalSettings,
	settingsAfterLogin,
	withCustomTheme,
	withSelectedTheme,
	withoutCustomTheme,
	writeLocalSettings,
} from '../scripts/settings';
import { applyTheme, getBrowserStorage } from '../scripts/theme';
import { resolveThemeColors } from '../scripts/themes';
import { useCurrentUser } from './AuthContext';
import { themeContext } from './ThemeContext';

const SAVE_DELAY_MS = 600;

export function ThemeProvider({ children }: { children: ReactNode }) {
	const { user } = useCurrentUser();
	const userID = user?.userID ?? null;

	const [settings, setSettings] = useState<UserSettings>(
		() => readLocalSettings(getBrowserStorage()) ?? DEFAULT_SETTINGS,
	);
	const [hasSaveError, setHasSaveError] = useState(false);
	// Always holds the newest settings, so several changes in one event never lose updates.
	const latest = useRef(settings);
	const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const { id, colors } = resolveThemeColors(settings.themeId, settings.customThemes);
		applyTheme(id, colors);
	}, [settings]);

	useEffect(
		() => () => {
			if (saveTimer.current) {
				clearTimeout(saveTimer.current);
			}
		},
		[],
	);

	const saveToServer = useCallback((next: UserSettings) => {
		api.settings
			.save(next)
			.then(() => setHasSaveError(false))
			.catch(() => setHasSaveError(true));
	}, []);

	// After login the account's stored settings always win; only when the account has none yet
	// are this device's settings adopted and saved (see settingsAfterLogin).
	useEffect(() => {
		if (!userID) {
			return;
		}

		let isActive = true;

		api.settings
			.get()
			.then((response) => {
				if (!isActive) {
					return;
				}

				const server = response.settings ? parseSettings(response.settings) : null;
				const { settings: next, shouldSave } = settingsAfterLogin(
					latest.current,
					server,
					response.isStored === true,
				);

				if (next !== latest.current) {
					latest.current = next;
					setSettings(next);
					writeLocalSettings(getBrowserStorage(), next);
				}

				if (shouldSave) {
					saveToServer(next);
				}
			})
			.catch(() => undefined);

		return () => {
			isActive = false;
		};
	}, [userID, saveToServer]);

	const commit = useCallback(
		(recipe: (previous: UserSettings) => UserSettings) => {
			const next = recipe(latest.current);
			latest.current = next;
			setSettings(next);
			writeLocalSettings(getBrowserStorage(), next);

			// Guests only keep settings on this device; signed-in users are saved to the account.
			if (userID) {
				if (saveTimer.current) {
					clearTimeout(saveTimer.current);
				}
				saveTimer.current = setTimeout(() => saveToServer(latest.current), SAVE_DELAY_MS);
			}
		},
		[userID, saveToServer],
	);

	const selectTheme = useCallback(
		(themeId: string) => commit((previous) => withSelectedTheme(previous, themeId)),
		[commit],
	);

	const saveCustomTheme = useCallback(
		(theme: CustomTheme, options?: { select: boolean }) =>
			commit((previous) => withCustomTheme(previous, theme, options?.select ?? false)),
		[commit],
	);

	const deleteCustomTheme = useCallback(
		(themeId: string) => commit((previous) => withoutCustomTheme(previous, themeId)),
		[commit],
	);

	return (
		<themeContext.Provider
			value={{
				themeId: settings.themeId,
				customThemes: settings.customThemes,
				selectTheme,
				saveCustomTheme,
				deleteCustomTheme,
				hasSaveError,
			}}
		>
			{children}
		</themeContext.Provider>
	);
}
