import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BottomNav } from '../../components/layout/BottomNav';
import { HotkeysHost } from '../../components/HotkeysHost';
import { LeftColumn } from '../../components/layout/LeftColumn';
import { SideNav } from '../../components/layout/SideNav';
import { useNotifications } from '../../providers/NotificationsContext';
import { pageTitle } from '../../scripts/pageTitle';

export default function MainLayout() {
	const { t } = useTranslation();
	const { pathname } = useLocation();
	const { unreadCount } = useNotifications();

	// The tab shows where you are, and how many notifications wait.
	useEffect(() => {
		document.title = pageTitle(pathname, unreadCount, (section) => t(`nav.${section}`));
	}, [pathname, unreadCount, t]);

	return (
		<div className='min-h-screen bg-surface text-main flex justify-center'>
			<LeftColumn />
			<main className='w-full max-w-[600px] min-h-screen border-x border-line pb-16 sm:pb-0'>
				<Outlet />
			</main>
			<SideNav />
			<BottomNav />
			<HotkeysHost />
		</div>
	);
}
