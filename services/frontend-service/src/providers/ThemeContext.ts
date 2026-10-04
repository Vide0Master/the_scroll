import { createContext, useContext } from 'react';
import type { CustomTheme } from '@the-scroll/types';

export interface ThemeContextValue {
	themeId: string;
	customThemes: CustomTheme[];
	selectTheme: (themeId: string) => void;
	saveCustomTheme: (theme: CustomTheme, options?: { select: boolean }) => void;
	deleteCustomTheme: (themeId: string) => void;
	hasSaveError: boolean;
}

export const themeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
	const value = useContext(themeContext);
	if (!value) {
		throw new Error('useTheme must be used inside ThemeProvider');
	}
	return value;
}
