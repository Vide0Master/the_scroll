import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router-dom';

export default function AuthLayout() {
	const { t } = useTranslation();

	return (
		<div className='w-screen h-screen bg-surface flex flex-col items-center justify-center text-main'>
			<div className='flex flex-col items-center justify-center gap-2 border border-line bg-panel p-4'>
				<Outlet />
				<div className='flex flex-row items-center justify-center gap-3 font-mono text-xs uppercase tracking-wide'>
					<Link
						to={'/auth/login'}
						className='text-muted hover:text-accent'
					>
						{t('auth.login.tab')}
					</Link>
					<Link
						to={'/auth/register'}
						className='text-muted hover:text-accent'
					>
						{t('auth.register.tab')}
					</Link>
				</div>
			</div>
		</div>
	);
}
