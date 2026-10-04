import type { ButtonHTMLAttributes } from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ children, className = '', ...props }: ButtonProps) {
	return (
		<button
			className={`px-4 py-2 border border-accent bg-transparent text-accent font-mono text-xs font-semibold uppercase tracking-wider hover:bg-accent hover:text-on-accent disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-accent transition-colors ${className}`}
			{...props}
		>
			{children && <span>{children}</span>}
		</button>
	);
}
