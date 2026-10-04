import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { NotificationItem } from '@the-scroll/types';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Avatar } from '../../../elements/Avatar';
import { useCurrentUser } from '../../../providers/AuthContext';
import { useNotifications } from '../../../providers/NotificationsContext';
import { api } from '../../../scripts/api';
import { notificationArrived } from '../../../scripts/events';
import {
	describeGroup,
	groupNotifications,
	type NotificationGroup,
	notificationPath,
} from '../../../scripts/notifications';
import { formatFull, formatPostDate, useNow } from '../../../scripts/time';

/** The signed-in user's notifications; new ones appear at the top as they arrive. */
export default function Notifications() {
	const { t, i18n } = useTranslation();
	const now = useNow();
	const { user, isLoading: isUserLoading } = useCurrentUser();
	const { unreadCount, markAllRead, markRead } = useNotifications();
	const [items, setItems] = useState<NotificationItem[] | null>(null);
	const [hasError, setHasError] = useState(false);

	useEffect(() => {
		if (!user) {
			return;
		}

		let isActive = true;

		api.notifications
			.list()
			.then((response) => {
				if (!isActive) {
					return;
				}

				// Unread ones stay highlighted until the user deals with them.
				setItems(response.notifications);
			})
			.catch(() => isActive && setHasError(true));

		return () => {
			isActive = false;
		};
	}, [user]);

	useEffect(() => {
		return notificationArrived.on((item) => {
			setItems((current) => [item, ...(current ?? [])]);
		});
	}, []);

	// Opening a notification reads it (all likes of a grouped row together).
	const open = (group: NotificationGroup) => {
		const unread = group.items.filter((item) => !item.isRead).map((item) => item.id);

		if (unread.length > 0) {
			setItems(
				(current) =>
					current?.map((item) =>
						unread.includes(item.id) ? { ...item, isRead: true } : item,
					) ?? null,
			);
			void markRead(unread);
		}
	};

	const readAll = () => {
		setItems((current) => current?.map((item) => ({ ...item, isRead: true })) ?? null);
		void markAllRead();
	};

	if (!isUserLoading && !user) {
		return (
			<>
				<PageHeader title={t('nav.notifications')} />
				<div className='p-8 text-center text-muted'>{t('notifications.loginRequired')}</div>
			</>
		);
	}

	return (
		<>
			<PageHeader title={t('nav.notifications')} />

			{hasError && (
				<div className='p-8 text-center text-red-500'>{t('notifications.loadError')}</div>
			)}

			{items === null && !hasError && <div className='h-24 bg-hover animate-pulse' />}

			{items?.length === 0 && (
				<div className='p-8 text-center text-sm text-muted'>{t('notifications.empty')}</div>
			)}

			{unreadCount > 0 && (
				<div className='flex justify-end px-4 py-2 border-b border-line'>
					<button
						type='button'
						onClick={readAll}
						className='bg-none border-none p-0 font-mono text-xs uppercase text-accent hover:underline'
					>
						{t('notifications.markAll')}
					</button>
				</div>
			)}

			{items &&
				groupNotifications(items).map((group) => (
					<Link
						key={group.key}
						to={notificationPath(group.latest)}
						onClick={() => open(group)}
						className='flex items-center gap-3 px-4 py-3 border-b border-line hover:bg-hover transition-colors'
					>
						{/* A red square marks what was unread when the page opened. */}
						<span
							aria-hidden='true'
							className={`w-2 h-2 shrink-0 ${group.isRead ? '' : 'bg-red-600'}`}
						/>
						<Avatar
							name={
								group.latest.actor?.visibleName ||
								group.latest.actor?.userName ||
								'?'
							}
							src={group.latest.actor?.avatarUrl}
						/>
						<div className='flex flex-col min-w-0'>
							<span className='text-sm'>{describeGroup(t, group)}</span>
							<time
								dateTime={group.latest.createdAt}
								title={formatFull(group.latest.createdAt, i18n.language)}
								className='font-mono text-xs text-muted'
							>
								{formatPostDate(group.latest.createdAt, i18n.language, now)}
							</time>
						</div>
					</Link>
				))}
		</>
	);
}
