import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '../../providers/AuthContext';
import { api } from '../../scripts/api';

export function VerifyEmail() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { refresh } = useCurrentUser();
	const [searchParams] = useSearchParams();
	const [isFailed, setIsFailed] = useState(!searchParams.get('token'));
	// The token is single-use: StrictMode's double effect run must not call verify twice.
	const hasStarted = useRef(false);

	useEffect(() => {
		const token = searchParams.get('token');

		if (!token || hasStarted.current) {
			return;
		}

		hasStarted.current = true;

		api.auth
			.verify(token)
			.then(async () => {
				await refresh();
				navigate('/', { replace: true });
			})
			.catch(() => setIsFailed(true));
	}, [searchParams, navigate, refresh]);

	if (isFailed) {
		return (
			<div className='flex flex-col gap-2 items-center justify-center'>
				<p className='text-red-500 text-sm'>{t('auth.verify.failed')}</p>
				<Link to='/auth/register'>{t('auth.verify.backToRegister')}</Link>
			</div>
		);
	}

	return <p>{t('auth.verify.progress')}</p>;
}
