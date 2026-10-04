import { Link } from 'react-router-dom';
import { useCurrentUser } from '../providers/AuthContext';
import { profilePath } from '../scripts/routes';
import { GuestActions } from './GuestActions';
import { UserCard } from './UserCard';

export function CurrentUserCard() {
	const { user, isLoading } = useCurrentUser();

	if (isLoading) {
		return <div className='h-14 w-full bg-panel animate-pulse' />;
	}

	if (!user) {
		return <GuestActions />;
	}

	return (
		<Link
			to={profilePath(user.userName)}
			className='block'
		>
			<UserCard
				userName={user.userName}
				visibleName={user.visibleName}
				avatarUrl={user.avatarUrl}
				className='w-full p-3 hover:bg-hover'
			/>
		</Link>
	);
}
