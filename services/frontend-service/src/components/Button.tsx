import type { ButtonHTMLAttributes } from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ children, className = '', ...props }: ButtonProps) {
	return (
		<button
			className={`px-2 py-1 border border-accent bg-control hover:bg-accent ${className}`}
			{...props}
		>
			{children && <span>{children}</span>}
		</button>
	);
}
