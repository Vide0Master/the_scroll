import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from './PageHeader';

export interface SettingsSectionProps {
	title: string;
	/** Where "back" goes when the page was opened by address. */
	backTo?: string;
	children: ReactNode;
}

/** A settings page that takes over the panel: title with a back button on top. */
export function SettingsSection({ title, backTo = '/settings', children }: SettingsSectionProps) {
	const navigate = useNavigate();
	const { key } = useLocation();

	// "default" is the first entry of this tab's history (page opened by address): there is
	// nothing to go back to inside the app, so go to the menu instead of leaving the site.
	const goBack = () => (key === 'default' ? navigate(backTo, { replace: true }) : navigate(-1));

	return (
		<>
			<PageHeader
				title={title}
				onBack={goBack}
			/>
			{children}
		</>
	);
}
