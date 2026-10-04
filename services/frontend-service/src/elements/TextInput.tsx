import { forwardRef, useRef, type ChangeEvent, type InputHTMLAttributes } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
	children?: string;
	onThrottledChange?: (value: string) => void;
	throttleMs?: number;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const TextInput = forwardRef<HTMLInputElement, InputProps>(
	(
		{
			type = 'text',
			className = '',
			children,
			onThrottledChange,
			throttleMs = 500,
			onChange,
			...props
		},
		ref,
	) => {
		const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

		const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
			if (onChange) onChange(e);

			if (onThrottledChange) {
				if (timeoutRef.current) clearTimeout(timeoutRef.current);

				timeoutRef.current = setTimeout(() => {
					onThrottledChange(e.target.value);
				}, throttleMs);
			}
		};

		return (
			<input
				ref={ref}
				type={type}
				className={`px-3 py-2 bg-transparent text-main placeholder:text-muted border border-line outline-none focus:border-accent ${className}`}
				placeholder={children || props.placeholder}
				onChange={handleChange}
				{...props}
			/>
		);
	},
);
