import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import type { Types } from '@the-scroll/types';
import { useCurrentUser } from '../../providers/AuthContext';
import { api, getApiError } from '../../scripts/api';
import { Button } from '../../elements/Button';
import { TextInput } from '../../elements/TextInput';
import { FormField } from '../../elements/FormField';

type LoginFormValues = Types['api']['auth']['login']['req'];

export function LoginForm() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { refresh } = useCurrentUser();
	const [submitError, setSubmitError] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<LoginFormValues>({
		mode: 'onChange',
	});

	const onSubmit = async (data: LoginFormValues) => {
		setSubmitError(null);

		try {
			await api.auth.login({
				loginName: data.loginName,
				password: data.password,
			});
			await refresh();
			navigate('/', { replace: true });
		} catch (error) {
			const { code } = getApiError(error);
			setSubmitError(
				code === 'loginPasswordError'
					? t('auth.errors.loginPasswordError')
					: code === 'accountBanned'
						? t('auth.errors.accountBanned')
						: t('auth.errors.network'),
			);
		}
	};

	return (
		<form
			onSubmit={handleSubmit(onSubmit)}
			className='flex flex-col gap-2 items-center justify-center'
		>
			<div className='self-start font-mono text-sm uppercase tracking-widest text-muted'>
				{t('auth.login.tab')}
			</div>

			<FormField error={errors.loginName && t('auth.errors.loginTooShort')}>
				<TextInput
					{...register('loginName', { required: true, minLength: 3 })}
					autoComplete='username'
				>
					{t('auth.login.username')}
				</TextInput>
			</FormField>

			<FormField error={errors.password && t('auth.errors.passwordTooShort')}>
				<TextInput
					{...register('password', { required: true, minLength: 8 })}
					autoComplete='current-password'
					type='password'
				>
					{t('auth.login.password')}
				</TextInput>
			</FormField>

			{submitError && (
				<span
					role='alert'
					className='text-red-500 text-sm'
				>
					{submitError}
				</span>
			)}

			<Button
				disabled={isSubmitting}
				type='submit'
			>
				{isSubmitting ? '...' : t('auth.login.button')}
			</Button>
		</form>
	);
}
