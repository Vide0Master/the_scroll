import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router-dom';

export default function AuthLayout() {
	const { t } = useTranslation();

	return (
		<div className='w-screen h-screen bg-surface flex flex-col items-center justify-center text-main'>
			<div className='flex flex-col items-center justify-center gap-2 border border-outline p-2'>
				<Outlet />
				<div className='flex flex-row items-center justify-center gap-2'>
					<Link to={'/auth/login'}>{t('auth.login.tab')}</Link>
					<Link to={'/auth/register'}>{t('auth.register.tab')}</Link>
				</div>
			</div>
		</div>
	);
}
