import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useCurrentUser } from '../../../providers/AuthContext';

/** Frame of the moderation panel: the menu at `/admin`, each section at `/admin/<section>`. */
export default function Admin() {
	const { t } = useTranslation();
	const { user, isLoading } = useCurrentUser();

	if (isLoading) {
		return <div className='h-48 bg-hover animate-pulse' />;
	}

	// The server checks the role on every call; this only keeps everyone else from an empty page.
	if (!user?.roles.some((role) => role === 'ADMIN' || role === 'MODERATOR')) {
		return (
			<>
				<PageHeader title={t('admin.title')} />
				<div className='p-8 text-center text-muted'>{t('admin.forbidden')}</div>
			</>
		);
	}

	return <Outlet />;
}
