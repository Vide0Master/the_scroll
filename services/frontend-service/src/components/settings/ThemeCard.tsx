import type { ReactNode } from 'react';
import type { ThemeColors } from '@the-scroll/types';

export interface ThemeCardProps {
	name: string;
	colors: ThemeColors;
	isActive: boolean;
	onSelect: () => void;
	actions?: ReactNode;
}

export function ThemeCard({ name, colors, isActive, onSelect, actions }: ThemeCardProps) {
	return (
		<div
			className={`border bg-surface overflow-hidden ${isActive ? 'border-accent' : 'border-line'}`}
		>
			<button
				type='button'
				aria-pressed={isActive}
				onClick={onSelect}
				className='block w-full text-left'
			>
				<div
					aria-hidden='true'
					className='flex h-14'
				>
					<div
						className='flex-1'
						style={{ backgroundColor: colors.background }}
					/>
					<div
						className='flex-1'
						style={{ backgroundColor: colors.panel }}
					/>
					<div
						className='flex-1'
						style={{ backgroundColor: colors.accent }}
					/>
				</div>
				<div className='px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wide truncate'>
					{name}
				</div>
			</button>
			{actions && <div className='flex flex-wrap gap-1 px-2 pb-2'>{actions}</div>}
		</div>
	);
}
