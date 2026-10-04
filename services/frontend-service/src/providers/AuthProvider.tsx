import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api } from '../scripts/api';
import { authContext, type CurrentUser } from './AuthContext';

async function loadUser(): Promise<CurrentUser | null> {
	try {
		const data = await api.users.getMe();
		return data.userData ?? null;
	} catch {
		return null;
	}
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<CurrentUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let isActive = true;

		loadUser().then((loaded) => {
			if (isActive) {
				setUser(loaded);
				setIsLoading(false);
			}
		});

		return () => {
			isActive = false;
		};
	}, []);

	const refresh = useCallback(async () => {
		setUser(await loadUser());
	}, []);

	return (
		<authContext.Provider value={{ user, isLoading, refresh }}>{children}</authContext.Provider>
	);
}
