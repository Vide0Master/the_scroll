import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDownIcon } from '@heroicons/react/16/solid';

export interface DropdownOption {
	value: string;
	label: string;
}

export interface DropdownProps {
	options: DropdownOption[];
	value: string;
	onChange: (value: string) => void;
	className?: string;
}

export function Dropdown({ options, value, onChange, className = '' }: DropdownProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);
	const rootRef = useRef<HTMLDivElement>(null);

	const selected = options.find((option) => option.value === value);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const handlePointerDown = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		document.addEventListener('pointerdown', handlePointerDown);
		return () => document.removeEventListener('pointerdown', handlePointerDown);
	}, [isOpen]);

	const open = () => {
		setActiveIndex(
			Math.max(
				0,
				options.findIndex((option) => option.value === value),
			),
		);
		setIsOpen(true);
	};

	const select = (option: DropdownOption) => {
		onChange(option.value);
		setIsOpen(false);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (event.key === 'Escape') {
			setIsOpen(false);
			return;
		}

		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();

			if (!isOpen) {
				open();
				return;
			}

			const step = event.key === 'ArrowDown' ? 1 : -1;
			setActiveIndex((index) => (index + step + options.length) % options.length);
			return;
		}

		if ((event.key === 'Enter' || event.key === ' ') && isOpen) {
			event.preventDefault();
			select(options[activeIndex]);
		}
	};

	return (
		<div
			ref={rootRef}
			className={`relative ${className}`}
		>
			<button
				type='button'
				aria-haspopup='listbox'
				aria-expanded={isOpen}
				onClick={() => (isOpen ? setIsOpen(false) : open())}
				onKeyDown={handleKeyDown}
				className='flex w-full items-center justify-between gap-2 px-2 py-1 border border-line bg-panel text-main font-mono text-sm'
			>
				<span>{selected?.label}</span>
				<ChevronDownIcon height={16} />
			</button>

			{isOpen && (
				<ul
					role='listbox'
					className='absolute z-10 mt-1 w-full border border-line bg-panel text-main font-mono text-sm'
				>
					{options.map((option, index) => (
						<li
							key={option.value}
							role='option'
							aria-selected={option.value === value}
							onClick={() => select(option)}
							onMouseEnter={() => setActiveIndex(index)}
							className={`px-2 py-1 cursor-pointer ${index === activeIndex ? 'bg-hover' : ''}`}
						>
							{option.label}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
