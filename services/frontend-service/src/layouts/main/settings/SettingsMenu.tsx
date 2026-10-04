import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/layout/PageHeader';

const SETTINGS_SECTIONS = ['profile', 'theme', 'notifications'] as const;

export default function SettingsMenu() {
	const { t } = useTranslation();

	return (
		<>
			<PageHeader title={t('settings.title')} />
			<nav
				aria-label={t('settings.title')}
				className='flex flex-col divide-y divide-line border-b border-line'
			>
				{SETTINGS_SECTIONS.map((section) => (
					<Link
						key={section}
						to={section}
						className='flex items-center justify-between px-4 py-4 font-mono text-sm uppercase tracking-wide hover:bg-hover'
					>
						{t(`settings.sections.${section}`)}
						<ChevronRightIcon
							className='w-5 h-5 text-muted'
							strokeWidth={1.25}
						/>
					</Link>
				))}
			</nav>
		</>
	);
}
