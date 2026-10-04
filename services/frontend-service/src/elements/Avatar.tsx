export interface AvatarProps {
	name: string;
	/** Uploaded picture; without one the first letter of `name` is shown. */
	src?: string | null;
	size?: 'sm' | 'md' | 'lg' | 'xl';
	className?: string;
}

const sizeClasses = {
	sm: 'w-8 h-8 text-sm',
	md: 'w-10 h-10 text-base',
	lg: 'w-16 h-16 text-2xl',
	xl: 'w-28 h-28 text-5xl',
};

export function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
	if (src) {
		// No background behind the picture, so a transparent PNG/WebP keeps its transparency.
		return (
			<img
				src={src}
				alt=''
				aria-hidden='true'
				className={`${sizeClasses[size]} object-cover shrink-0 select-none ${className}`}
			/>
		);
	}

	return (
		<div
			aria-hidden='true'
			className={`${sizeClasses[size]} bg-accent/20 text-accent flex items-center justify-center font-mono font-bold uppercase shrink-0 select-none ${className}`}
		>
			{name[0] ?? '?'}
		</div>
	);
}
