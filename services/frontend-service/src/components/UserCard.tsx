import { Avatar } from '../elements/Avatar';

export interface UserCardProps {
	userName: string;
	visibleName?: string | null;
	avatarUrl?: string | null;
	className?: string;
}

export function UserCard({ userName, visibleName, avatarUrl, className = '' }: UserCardProps) {
	return (
		<div className={`flex items-center gap-3 select-none ${className}`}>
			<Avatar
				name={visibleName || userName}
				src={avatarUrl}
			/>

			<div className='flex flex-col min-w-0 leading-tight'>
				{visibleName ? (
					<>
						<span className='font-mono font-bold text-sm uppercase tracking-wide truncate text-main'>
							{visibleName}
						</span>
						<span className='font-mono text-sm text-muted truncate'>@{userName}</span>
					</>
				) : (
					<span className='font-mono font-bold text-sm uppercase tracking-wide truncate text-main'>
						@{userName}
					</span>
				)}
			</div>
		</div>
	);
}
