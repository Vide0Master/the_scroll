export interface ColorInputProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
}

// The native color input always yields lowercase #rrggbb, which is exactly the accepted format.
export function ColorInput({ label, value, onChange }: ColorInputProps) {
	return (
		<label className='flex items-center justify-between gap-3'>
			<span className='font-mono text-xs uppercase tracking-wide text-muted'>{label}</span>
			<input
				type='color'
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className='h-8 w-12 cursor-pointer border border-line bg-transparent'
			/>
		</label>
	);
}
