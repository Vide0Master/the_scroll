import type { ReactNode } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../../elements/IconButton';

export interface PageHeaderProps {
	title?: string;
	/** Shows a back button to the left of the title. */
	onBack?: () => void;
	children?: ReactNode;
}

export function PageHeader({ title, onBack, children }: PageHeaderProps) {
	const { t } = useTranslation();

	return (
		<header className='sticky top-0 z-10 bg-surface/80 backdrop-blur border-b border-line'>
			{(title || onBack) && (
				<div className='flex items-center gap-1 px-2'>
					{onBack && (
						<IconButton
							label={t('nav.back')}
							onClick={onBack}
						>
							<ArrowLeftIcon
								className='w-5 h-5'
								strokeWidth={1.25}
							/>
						</IconButton>
					)}
					{title && (
						<h1 className={`py-3 text-xl font-bold ${onBack ? '' : 'px-2'}`}>
							{title}
						</h1>
					)}
				</div>
			)}
			{children}
		</header>
	);
}
