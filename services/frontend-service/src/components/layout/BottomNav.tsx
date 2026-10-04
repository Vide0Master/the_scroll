import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
	BellIcon,
	Cog6ToothIcon,
	HomeIcon,
	MagnifyingGlassIcon,
	UserIcon,
} from '@heroicons/react/24/outline';
import { useNotifications } from '../../providers/NotificationsContext';
import { UnreadBadge } from '../UnreadBadge';
import { useCurrentUser } from '../../providers/AuthContext';
import { profilePath } from '../../scripts/routes';

function linkClass({ isActive }: { isActive: boolean }) {
	return `p-3 ${isActive ? 'text-accent' : 'text-muted'}`;
}

export function BottomNav() {
	const { t } = useTranslation();
	const { user } = useCurrentUser();
	const { unreadCount } = useNotifications();

	return (
		<nav className='sm:hidden fixed bottom-0 inset-x-0 z-20 flex justify-around bg-surface border-t border-line py-1'>
			<NavLink
				to='/'
				end
				aria-label={t('nav.home')}
				className={linkClass}
			>
				<HomeIcon
					className='w-6 h-6'
					strokeWidth={1.25}
				/>
			</NavLink>
			<NavLink
				to='/search'
				aria-label={t('widgets.search')}
				className={linkClass}
			>
				<MagnifyingGlassIcon
					className='w-6 h-6'
					strokeWidth={1.25}
				/>
			</NavLink>
			{user && (
				<NavLink
					to='/notifications'
					aria-label={t('nav.notifications')}
					className={linkClass}
				>
					<span className='relative block'>
						<BellIcon
							className='w-6 h-6'
							strokeWidth={1.25}
						/>
						<UnreadBadge count={unreadCount} />
					</span>
				</NavLink>
			)}
			{user && (
				<NavLink
					to={profilePath(user.userName)}
					aria-label={t('nav.profile')}
					className={linkClass}
				>
					<UserIcon
						className='w-6 h-6'
						strokeWidth={1.25}
					/>
				</NavLink>
			)}
			<NavLink
				to='/settings'
				aria-label={t('nav.settings')}
				className={linkClass}
			>
				<Cog6ToothIcon
					className='w-6 h-6'
					strokeWidth={1.25}
				/>
			</NavLink>
			{!user && (
				<NavLink
					to='/auth/login'
					aria-label={t('auth.login.tab')}
					className={linkClass}
				>
					<UserIcon
						className='w-6 h-6'
						strokeWidth={1.25}
					/>
				</NavLink>
			)}
		</nav>
	);
}
