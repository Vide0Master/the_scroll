export interface UnreadBadgeProps {
	count: number;
}

/** Small red square with the unread number; renders nothing at zero. Sits at a corner of its (relative) parent. */
export function UnreadBadge({ count }: UnreadBadgeProps) {
	if (count <= 0) {
		return null;
	}

	return (
		<span
			data-testid='unread-badge'
			className='absolute -top-2 -right-2 min-w-4 h-4 px-1 bg-red-600 text-white font-mono text-[10px] font-bold leading-4 text-center'
		>
			{count > 99 ? '99+' : count}
		</span>
	);
}
