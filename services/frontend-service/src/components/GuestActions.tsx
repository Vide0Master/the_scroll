import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '../elements/Button';

export function GuestActions() {
	const { t } = useTranslation();
	const navigate = useNavigate();

	return (
		<div className='flex flex-col gap-2 w-full'>
			<Button onClick={() => navigate('/auth/login')}>{t('auth.guest.login')}</Button>
			<Button onClick={() => navigate('/auth/register')}>{t('auth.guest.register')}</Button>
		</div>
	);
}
