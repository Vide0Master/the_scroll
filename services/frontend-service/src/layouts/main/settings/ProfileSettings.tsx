import { useTranslation } from 'react-i18next';
import { SettingsSection } from '../../../components/layout/SettingsSection';
import { ProfileEditor } from '../../../components/settings/ProfileEditor';

export default function ProfileSettings() {
	const { t } = useTranslation();

	return (
		<SettingsSection title={t('settings.sections.profile')}>
			<ProfileEditor />
		</SettingsSection>
	);
}
