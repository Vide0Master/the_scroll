import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/layout/PageHeader';

const ADMIN_SECTIONS = ['users', 'banned', 'posts', 'metrics'] as const;

export default function AdminMenu() {
	const { t } = useTranslation();

	return (
		<>
			<PageHeader title={t('admin.title')} />
			<nav
				aria-label={t('admin.title')}
				className='flex flex-col divide-y divide-line border-b border-line'
			>
				{ADMIN_SECTIONS.map((section) => (
					<Link
						key={section}
						to={section}
						className='flex items-center justify-between px-4 py-4 font-mono text-sm uppercase tracking-wide hover:bg-hover'
					>
						{t(`admin.tabs.${section}`)}
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
