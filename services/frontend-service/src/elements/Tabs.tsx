export interface TabItem {
	id: string;
	label: string;
	disabled?: boolean;
}

export interface TabsProps {
	tabs: TabItem[];
	activeId: string;
	onChange?: (id: string) => void;
}

export function Tabs({ tabs, activeId, onChange }: TabsProps) {
	return (
		<div
			role='tablist'
			className='flex w-full'
		>
			{tabs.map((tab) => {
				const isActive = tab.id === activeId;

				return (
					<button
						key={tab.id}
						type='button'
						role='tab'
						aria-selected={isActive}
						disabled={tab.disabled}
						onClick={() => onChange?.(tab.id)}
						className={`flex-1 py-3 font-mono text-xs uppercase tracking-wider transition-colors hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent ${isActive ? 'text-main font-semibold' : 'text-muted'}`}
					>
						<span
							className={`inline-block py-3 ${isActive ? 'border-b-2 border-accent' : 'border-b-2 border-transparent'}`}
						>
							{tab.label}
						</span>
					</button>
				);
			})}
		</div>
	);
}
