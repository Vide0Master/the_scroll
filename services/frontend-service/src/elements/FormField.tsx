import type { ReactNode } from 'react';

export interface FormFieldProps {
	error?: string;
	children: ReactNode;
}

export function FormField({ error, children }: FormFieldProps) {
	return (
		<div className='flex flex-col gap-1 w-full'>
			{children}
			{error && (
				<span
					role='alert'
					className='text-red-500 text-sm'
				>
					{error}
				</span>
			)}
		</div>
	);
}
