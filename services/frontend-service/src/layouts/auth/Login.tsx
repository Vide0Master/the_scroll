import { useTranslation } from 'react-i18next';
import { TextInput } from '../../components/TextInput';
import { Button } from '../../components/Button';
import { useForm } from 'react-hook-form';
import type { Types } from '@the-scroll/types';
import { api } from '../../scripts/api';

type LoginFormValues = Types['api']['auth']['login']['req'];

export default function Login() {
	const { t } = useTranslation();
	const {
		register,
		handleSubmit,
		setError,
		clearErrors,
		getValues,
		formState: { errors, isSubmitting },
	} = useForm<LoginFormValues>({
		mode: 'onChange',
	});

	const onSubmit = async (data: LoginFormValues) => {
		try {
			await api.auth.login({
				loginName: data.loginName,
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
			<div className='self-start'>{t('auth.login.tab')}</div>

			<TextInput
				{...register('loginName', {
					required: { value: true, message: 'required' },
					minLength: { value: 3, message: 'logintooshort' },
				})}
				autoComplete='username'
			>
				{t('auth.login.username')}
			</TextInput>
			{errors.loginName?.message && (
				<span className='text-red-500 text-sm'>{t(errors.loginName.message)}</span>
			)}

			<TextInput
				{...register('password', {
					required: { value: true, message: 'required' },
					minLength: { value: 3, message: 'passtooshort' },
				})}
				autoComplete='password'
				type='password'
			>
				{t('auth.login.password')}
			</TextInput>
			{errors.loginName?.message && (
				<span className='text-red-500 text-sm'>{t(errors.loginName.message)}</span>
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
