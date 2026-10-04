import { createContext, useContext } from 'react';
import type { Types } from '@the-scroll/types';

export type CurrentUser = NonNullable<Types['api']['auth']['user']['res']['userData']>;

export interface AuthContextValue {
	user: CurrentUser | null;
	isLoading: boolean;
	refresh: () => Promise<void>;
}

export const authContext = createContext<AuthContextValue | null>(null);

export function useCurrentUser(): AuthContextValue {
	const value = useContext(authContext);
	if (!value) {
		throw new Error('useCurrentUser must be used inside AuthProvider');
	}
	return value;
}
