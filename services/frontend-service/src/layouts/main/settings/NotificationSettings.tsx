import { useTranslation } from 'react-i18next';
import { SettingsSection } from '../../../components/layout/SettingsSection';
import { useToast } from '../../../providers/ToastContext';

export default function NotificationSettings() {
	const { t } = useTranslation();
	const { areEventToastsEnabled, setEventToastsEnabled } = useToast();

	return (
		<SettingsSection title={t('settings.sections.notifications')}>
			<label className='flex items-start gap-3 px-4 py-4 border-b border-line cursor-pointer'>
				<input
					type='checkbox'
					checked={areEventToastsEnabled}
					onChange={(event) => setEventToastsEnabled(event.target.checked)}
					className='mt-1'
				/>
				<span className='flex flex-col gap-1'>
					<span className='font-mono text-sm uppercase tracking-wide'>
						{t('settings.notifyToasts')}
					</span>
					<span className='text-sm text-muted'>{t('settings.notifyToastsHint')}</span>
				</span>
			</label>
		</SettingsSection>
	);
}
