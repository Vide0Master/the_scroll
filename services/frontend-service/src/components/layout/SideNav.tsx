import { useCallback, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
	BellIcon,
	Cog6ToothIcon,
	EnvelopeIcon,
	HashtagIcon,
	HomeIcon,
	PencilSquareIcon,
	UserIcon,
	ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { Avatar } from '../../elements/Avatar';
import type { FeedPost } from '@the-scroll/types';
import { Button } from '../../elements/Button';
import { IconButton } from '../../elements/IconButton';
import { useCurrentUser } from '../../providers/AuthContext';
import { postCreated } from '../../scripts/events';
import { profilePath } from '../../scripts/routes';
import { CreatePostForm } from '../CreatePostForm';
import { CurrentUserCard } from '../CurrentUserCard';
import { UnreadBadge } from '../UnreadBadge';
import { useNotifications } from '../../providers/NotificationsContext';
import { Popup } from '../Popup';

interface NavEntry {
	key: string;
	label: string;
	icon: typeof HomeIcon;
	to?: string;
	/** Unread count shown as a red square by the icon. */
	badge?: number;
}

const itemClass = 'flex items-center gap-4 px-3 py-3 xl:pr-6 transition-colors';
const labelClass = 'hidden xl:inline font-mono text-sm uppercase tracking-wide';

function navLinkClass({ isActive }: { isActive: boolean }) {
	return `${itemClass} hover:bg-hover ${isActive ? 'font-semibold text-accent' : ''}`;
}

export function SideNav() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { user } = useCurrentUser();
	const { unreadCount } = useNotifications();
	const [isPopupOpen, setIsPopupOpen] = useState(false);

	const openPopup = useCallback(() => setIsPopupOpen(true), []);
	const closePopup = useCallback(() => setIsPopupOpen(false), []);

	const handlePosted = useCallback(
		(post?: FeedPost) => {
			setIsPopupOpen(false);

			if (post) {
				postCreated.emit(post);
			}

			navigate('/');
		},
		[navigate],
	);

	// Explore, Notifications and Messages are mocks: shown, but not navigable yet.
	const entries: NavEntry[] = [
		{ key: 'home', label: t('nav.home'), icon: HomeIcon, to: '/' },
		{ key: 'explore', label: t('nav.explore'), icon: HashtagIcon, to: '/search' },
		{
			key: 'notifications',
			label: t('nav.notifications'),
			icon: BellIcon,
			// A mock for guests: there is nobody to notify.
			...(user ? { to: '/notifications', badge: unreadCount } : {}),
		},
		{ key: 'messages', label: t('nav.messages'), icon: EnvelopeIcon },
		...(user
			? [
					{
						key: 'profile',
						label: t('nav.profile'),
						icon: UserIcon,
						to: profilePath(user.userName),
					},
				]
			: []),
		...(user?.roles.length
			? [{ key: 'admin', label: t('nav.admin'), icon: ShieldCheckIcon, to: '/admin' }]
			: []),
		{ key: 'settings', label: t('nav.settings'), icon: Cog6ToothIcon, to: '/settings' },
	];

	return (
		<>
			<aside className='hidden sm:flex flex-col justify-between sticky top-0 h-screen w-[68px] xl:w-[275px] shrink-0 px-2 py-2'>
				<div className='flex flex-col gap-1'>
					<Link
						to='/'
						className='px-3 py-3 font-mono font-bold text-lg text-accent tracking-tight'
					>
						<span className='xl:hidden'>~/</span>
						<span className='hidden xl:inline'>~/the-scroll</span>
					</Link>

					<nav className='flex flex-col gap-1'>
						{entries.map((entry) => {
							if (!entry.to) {
								return (
									<span
										key={entry.key}
										aria-disabled='true'
										title={t('nav.soon')}
										className={`${itemClass} opacity-50 cursor-not-allowed`}
									>
										<entry.icon
											className='w-6 h-6 shrink-0'
											strokeWidth={1.25}
										/>
										<span className={labelClass}>{entry.label}</span>
									</span>
								);
							}

							return (
								<NavLink
									key={entry.key}
									to={entry.to}
									end={entry.to === '/'}
									aria-label={entry.label}
									className={navLinkClass}
								>
									<span className='relative'>
										<entry.icon
											className='w-6 h-6 shrink-0'
											strokeWidth={1.25}
										/>
										<UnreadBadge count={entry.badge ?? 0} />
									</span>
									<span className={labelClass}>{entry.label}</span>
								</NavLink>
							);
						})}
					</nav>

					{user && (
						<div className='mt-3'>
							<Button
								onClick={openPopup}
								className='hidden xl:block w-full py-3 text-sm'
							>
								{t('nav.post')}
							</Button>
							<IconButton
								label={t('nav.post')}
								onClick={openPopup}
								className='xl:hidden border border-accent text-accent hover:bg-accent hover:text-on-accent'
							>
								<PencilSquareIcon
									className='w-6 h-6'
									strokeWidth={1.25}
								/>
							</IconButton>
						</div>
					)}
				</div>

				<div>
					<div className='hidden xl:block'>
						<CurrentUserCard />
					</div>
					<div className='xl:hidden flex justify-center'>
						{user ? (
							<Avatar
								name={user.visibleName || user.userName}
								src={user.avatarUrl}
							/>
						) : (
							<IconButton
								label={t('auth.login.tab')}
								onClick={() => navigate('/auth/login')}
							>
								<UserIcon
									className='w-6 h-6'
									strokeWidth={1.25}
								/>
							</IconButton>
						)}
					</div>
				</div>
			</aside>

			<Popup
				isOpen={isPopupOpen}
				onClose={closePopup}
				title={t('nav.post')}
				isFlush
			>
				<CreatePostForm onPostCreated={handlePosted} />
			</Popup>
		</>
	);
}
