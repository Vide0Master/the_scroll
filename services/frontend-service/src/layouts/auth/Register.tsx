import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import type { Types } from '@the-scroll/types';
import { api } from '../../scripts/api';
import { Button } from '../../components/Button';
import { TextInput } from '../../components/TextInput';

type RegisterFormValues = Types['api']['auth']['register']['req'] & {
	repeatPassword: string;
};

export default function Register() {
	const { t } = useTranslation();
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
		try {
			await api.auth.register({
				username: data.username,
				email: data.email,
				password: data.password,
			});
		} catch {
			/* empty */
		}
	};

	return (
		<form
			onSubmit={handleSubmit(onSubmit)}
			className='flex flex-col gap-2 items-center justify-center'
		>
			<div className='self-start'>{t('auth.register.tab')}</div>

			<TextInput
				{...register('username', { required: true, minLength: 3 })}
				onThrottledChange={async (value) => {
					if (value.length >= 3) {
						const isAvailable = await api.auth.checkUsername({ username: value });
						if (!isAvailable) {
							setError('username', {
								type: 'manual',
								message: 'auth.errors.usernameTaken',
							});
						} else {
							clearErrors('username');
						}
					} else {
						setError('username', {
							type: 'manual',
							message: 'auth.errors.usernameTooShort',
						});
					}
				}}
			>
				{t('auth.register.username')}
			</TextInput>
			{errors.username?.message && (
				<span className='text-red-500 text-sm'>{t(errors.username.message)}</span>
			)}

			<TextInput
				type='email'
				{...register('email', { required: true })}
				onThrottledChange={async (value) => {
					if (/^\S+@\S+\.\S+$/.test(value)) {
						const isAvailable = await api.auth.checkEmail({ email: value });
						if (!isAvailable) {
							setError('email', {
								type: 'manual',
								message: 'auth.errors.emailTaken',
							});
						} else {
							clearErrors('email');
						}
					} else {
						setError('email', {
							type: 'manual',
							message: 'auth.errors.emailMalformed',
						});
					}
				}}
			>
				{t('auth.register.email')}
			</TextInput>
			{errors.email?.message && (
				<span className='text-red-500 text-sm'>{t(errors.email.message)}</span>
			)}

			<TextInput
				type='password'
				{...register('password', {
					required: true,
					minLength: { value: 8, message: 'auth.errors.passwordTooShort' },
					deps: ['repeatPassword'],
				})}
			>
				{t('auth.register.password')}
			</TextInput>
			{errors.password?.message && (
				<span className='text-red-500 text-sm'>{t(errors.password.message)}</span>
			)}

			<TextInput
				type='password'
				{...register('repeatPassword', {
					required: true,
					validate: (value) =>
						value === getValues('password') || 'auth.errors.passwordsMismatch',
				})}
			>
				{t('auth.register.repeatPassword')}
			</TextInput>
			{errors.repeatPassword?.message && (
				<span className='text-red-500 text-sm'>{t(errors.repeatPassword.message)}</span>
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
