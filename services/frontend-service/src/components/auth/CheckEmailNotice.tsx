import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { MailStatus } from '@the-scroll/types';
import { useCurrentUser } from '../../providers/AuthContext';
import { api, getApiError } from '../../scripts/api';
import { Button } from '../../elements/Button';

export interface CheckEmailNoticeProps {
	email: string;
	pendingID: string;
	initialStatus: MailStatus;
	initialError?: string;
	onEditData: () => void;
}

const POLL_INTERVAL_MS = 3000;

export function CheckEmailNotice({
	email,
	pendingID,
	initialStatus,
	initialError,
	onEditData,
}: CheckEmailNoticeProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { refresh } = useCurrentUser();
	const [status, setStatus] = useState<MailStatus>(initialStatus);
	const [mailError, setMailError] = useState(initialError);
	const [errorKey, setErrorKey] = useState<string | null>(null);
	const [resendAt, setResendAt] = useState(0);
	const [now, setNow] = useState(() => Date.now());

	const refreshStatus = useCallback(async () => {
		try {
			const data = await api.auth.getRegistrationStatus(pendingID);
			if (data.status) {
				setStatus(data.status);
			}
			setMailError(data.error);
			setResendAt(Date.now() + (data.retryAfter ?? 0) * 1000);
		} catch (error) {
			if (getApiError(error).code === 'notFound') {
				setErrorKey('auth.errors.registrationExpired');
			}
		}
	}, [pendingID]);

	useEffect(() => {
		if (status === 'CONFIRMED') {
			return;
		}

		const timer = setInterval(refreshStatus, POLL_INTERVAL_MS);
		return () => clearInterval(timer);
	}, [status, refreshStatus]);

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		if (status !== 'CONFIRMED') {
			return;
		}

		// The link may have been opened in this same browser, which then already has a session.
		api.users
			.getMe()
			.then(async (data) => {
				if (data.userData) {
					await refresh();
					navigate('/', { replace: true });
				}
			})
			.catch(() => undefined);
	}, [status, navigate, refresh]);

	const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

	const handleResend = async () => {
		setErrorKey(null);

		try {
			const data = await api.auth.resend(pendingID);
			if (data.status) {
				setStatus(data.status);
			}
			await refreshStatus();
		} catch (error) {
			const { code, retryAfter } = getApiError(error);

			if (code === 'resendCooldown') {
				setResendAt(Date.now() + (retryAfter ?? 60) * 1000);
			} else if (code === 'resendLimit') {
				setErrorKey('auth.errors.resendLimit');
			} else if (code === 'notFound') {
				setErrorKey('auth.errors.registrationExpired');
			} else {
				setErrorKey('auth.errors.network');
			}
		}
	};

	const statusText = (() => {
		switch (status) {
			case 'PENDING':
				return t('auth.checkEmail.sending');
			case 'SENT':
				return t('auth.checkEmail.sent');
			case 'FAILED':
				return t('auth.checkEmail.failed', { error: mailError ?? '' });
			case 'CONFIRMED':
				return t('auth.checkEmail.confirmedLogin');
		}
	})();

	return (
		<div className='flex flex-col gap-2 items-center justify-center max-w-xs text-center'>
			<div className='self-start font-mono text-sm uppercase tracking-widest text-muted'>
				{t('auth.checkEmail.title')}
			</div>

			<p>{t('auth.checkEmail.sentTo', { email })}</p>

			<p
				role='status'
				className={status === 'FAILED' ? 'text-red-500 text-sm' : 'text-sm'}
			>
				{statusText}
			</p>

			{status !== 'CONFIRMED' && <p className='text-sm'>{t('auth.checkEmail.spamHint')}</p>}

			{errorKey && (
				<span
					role='alert'
					className='text-red-500 text-sm'
				>
					{t(errorKey)}
				</span>
			)}

			{status !== 'CONFIRMED' && (
				<div className='flex flex-row gap-2'>
					<Button
						type='button'
						disabled={secondsLeft > 0}
						onClick={handleResend}
					>
						{secondsLeft > 0
							? t('auth.checkEmail.resendIn', { seconds: secondsLeft })
							: t('auth.checkEmail.resend')}
					</Button>
					<Button
						type='button'
						onClick={onEditData}
					>
						{t('auth.checkEmail.change')}
					</Button>
				</div>
			)}
		</div>
	);
}
