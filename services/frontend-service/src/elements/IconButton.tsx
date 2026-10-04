import type { ButtonHTMLAttributes } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	label: string;
}

export function IconButton({ label, className = '', children, ...props }: IconButtonProps) {
	return (
		<button
			type='button'
			aria-label={label}
			title={label}
			className={`p-2 transition-colors hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent ${className}`}
			{...props}
		>
			{children}
		</button>
	);
}
