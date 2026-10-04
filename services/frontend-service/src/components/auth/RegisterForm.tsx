import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import type { MailStatus, Types } from '@the-scroll/types';
import { api, getApiError } from '../../scripts/api';
import { Button } from '../../elements/Button';
import { TextInput } from '../../elements/TextInput';
import { FormField } from '../../elements/FormField';
import { CheckEmailNotice } from './CheckEmailNotice';

type RegisterFormValues = Omit<Types['api']['auth']['register']['req'], 'replacesID'> & {
	repeatPassword: string;
};

interface PendingState {
	id: string;
	email: string;
	username: string;
	status: MailStatus;
	error?: string;
}

export function RegisterForm() {
	const { t } = useTranslation();
	const [pending, setPending] = useState<PendingState | null>(null);
	const [submitError, setSubmitError] = useState<string | null>(null);
	// Lives in this component, so the entered data survives switching to the "check email" step.
	const {
		register,
		handleSubmit,
		setError,
		clearErrors,
		getValues,
		formState: { errors, isSubmitting },
	} = useForm<RegisterFormValues>({
		mode: 'onChange',
	});

	const onSubmit = async (data: RegisterFormValues) => {
		setSubmitError(null);

		try {
			const response = await api.auth.register({
				username: data.username,
				email: data.email,
				password: data.password,
				replacesID: pending?.id,
			});

			if (response.pendingID) {
				setPending({
					id: response.pendingID,
					email: data.email,
					username: data.username,
					status: response.status ?? 'PENDING',
					error: response.error,
				});
			}
		} catch (error) {
			const { code } = getApiError(error);

			if (code === 'emailBlocked') {
				setError('email', { type: 'manual', message: 'auth.errors.emailBlocked' });
			} else if (code === 'emailTaken') {
				setError('email', { type: 'manual', message: 'auth.errors.emailTaken' });
			} else if (code === 'usernameTaken') {
				setError('username', { type: 'manual', message: 'auth.errors.usernameTaken' });
			} else {
				setSubmitError(t('auth.errors.network'));
			}
		}
	};

	if (pending && !isSubmitting) {
		return (
			<CheckEmailNotice
				email={pending.email}
				pendingID={pending.id}
				initialStatus={pending.status}
				initialError={pending.error}
				onEditData={() => setPending(null)}
			/>
		);
	}

	const isOwnPending = (field: 'username' | 'email', value: string) => pending?.[field] === value;

	return (
		<form
			onSubmit={handleSubmit(onSubmit)}
			className='flex flex-col gap-2 items-center justify-center'
		>
			<div className='self-start font-mono text-sm uppercase tracking-widest text-muted'>
				{t('auth.register.tab')}
			</div>

			<FormField error={errors.username?.message && t(errors.username.message)}>
				<TextInput
					{...register('username', {
						required: 'auth.errors.required',
						minLength: { value: 3, message: 'auth.errors.usernameTooShort' },
					})}
					autoComplete='username'
					onThrottledChange={async (value) => {
						if (value.length < 3) {
							setError('username', {
								type: 'manual',
								message: 'auth.errors.usernameTooShort',
							});
						} else if (isOwnPending('username', value)) {
							clearErrors('username');
						} else if (!(await api.auth.checkUsername(value))) {
							setError('username', {
								type: 'manual',
								message: 'auth.errors.usernameTaken',
							});
						} else {
							clearErrors('username');
						}
					}}
				>
					{t('auth.register.username')}
				</TextInput>
			</FormField>

			<FormField error={errors.email?.message && t(errors.email.message)}>
				<TextInput
					type='email'
					{...register('email', {
						required: 'auth.errors.required',
						pattern: { value: /^\S+@\S+\.\S+$/, message: 'auth.errors.emailMalformed' },
					})}
					autoComplete='email'
					onThrottledChange={async (value) => {
						if (!/^\S+@\S+\.\S+$/.test(value)) {
							setError('email', {
								type: 'manual',
								message: 'auth.errors.emailMalformed',
							});
						} else if (isOwnPending('email', value)) {
							clearErrors('email');
						} else {
							const { isAvailable, isBlocked } = await api.auth.checkEmail(value);

							if (isAvailable) {
								clearErrors('email');
							} else {
								setError('email', {
									type: 'manual',
									message: isBlocked
										? 'auth.errors.emailBlocked'
										: 'auth.errors.emailTaken',
								});
							}
						}
					}}
				>
					{t('auth.register.email')}
				</TextInput>
			</FormField>

			<FormField error={errors.password?.message && t(errors.password.message)}>
				<TextInput
					type='password'
					{...register('password', {
						required: 'auth.errors.required',
						minLength: { value: 8, message: 'auth.errors.passwordTooShort' },
						deps: ['repeatPassword'],
					})}
					autoComplete='new-password'
				>
					{t('auth.register.password')}
				</TextInput>
			</FormField>

			<FormField error={errors.repeatPassword?.message && t(errors.repeatPassword.message)}>
				<TextInput
					type='password'
					{...register('repeatPassword', {
						required: 'auth.errors.required',
						validate: (value) =>
							value === getValues('password') || 'auth.errors.passwordsMismatch',
					})}
					autoComplete='new-password'
				>
					{t('auth.register.repeatPassword')}
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
				{isSubmitting ? '...' : t('auth.register.button')}
			</Button>
		</form>
	);
}
