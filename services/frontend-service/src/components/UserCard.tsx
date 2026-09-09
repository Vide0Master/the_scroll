import { useEffect, useState } from 'react';
import { api } from '../scripts/api';
import type { Types } from '@the-scroll/types';

type UserData = NonNullable<Types['api']['auth']['user']['res']['userData']>;

export function UserCard() {
	const [user, setUser] = useState<UserData | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);

	useEffect(() => {
		let isMounted = true;

		api.users
			.getMe()
			.then((data) => {
				if (isMounted && data.userData) {
					setUser(data.userData);
				}
			})
			.catch(() => {
				if (isMounted) {
					setUser(null);
				}
			})
			.finally(() => {
				if (isMounted) {
					setIsLoading(false);
				}
			});

		return () => {
			isMounted = false;
		};
	}, []);

	if (isLoading) {
		return <div className='p-3 rounded-xl bg-surface-secondary/50 animate-pulse h-14 w-full' />;
	}

	if (!user) {
		return null;
	}

	return (
		<div className='flex items-center gap-3 p-3 rounded-xl bg-surface-secondary/40 border border-border/20 w-full select-none'>
			<div className='w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold uppercase shrink-0'>
				{(user.visibleName || user.userName)[0]}
			</div>

			<div className='flex flex-col min-w-0 leading-tight'>
				{user.visibleName ? (
					<>
						<span className='font-medium text-sm truncate text-main'>
							{user.visibleName}
						</span>
						<span className='text-xs opacity-60 truncate'>@{user.userName}</span>
					</>
				) : (
					<span className='font-medium text-sm truncate text-main'>@{user.userName}</span>
				)}
			</div>
		</div>
	);
}
