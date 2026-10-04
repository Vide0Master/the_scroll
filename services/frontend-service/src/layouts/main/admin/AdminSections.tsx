import { useTranslation } from 'react-i18next';
import { AdminMetrics } from '../../../components/admin/AdminMetrics';
import { AdminPosts } from '../../../components/admin/AdminPosts';
import { AdminUsers } from '../../../components/admin/AdminUsers';
import { SettingsSection } from '../../../components/layout/SettingsSection';

export function AdminUsersPage() {
	const { t } = useTranslation();

	return (
		<SettingsSection
			title={t('admin.tabs.users')}
			backTo='/admin'
		>
			<AdminUsers />
		</SettingsSection>
	);
}

export function AdminBanned() {
	const { t } = useTranslation();

	return (
		<SettingsSection
			title={t('admin.tabs.banned')}
			backTo='/admin'
		>
			<AdminUsers onlyBanned />
		</SettingsSection>
	);
}

export function AdminPostsPage() {
	const { t } = useTranslation();

	return (
		<SettingsSection
			title={t('admin.tabs.posts')}
			backTo='/admin'
		>
			<AdminPosts />
		</SettingsSection>
	);
}

export function AdminMetricsPage() {
	const { t } = useTranslation();

	return (
		<SettingsSection
			title={t('admin.tabs.metrics')}
			backTo='/admin'
		>
			<AdminMetrics />
		</SettingsSection>
	);
}
