import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CustomTheme, ThemeColors } from '@the-scroll/types';
import { Button } from '../../elements/Button';
import { ColorInput } from '../../elements/ColorInput';
import { TextInput } from '../../elements/TextInput';
import { generateId } from '../../scripts/id';
import { MAX_THEME_NAME_LENGTH, hasLowContrast } from '../../scripts/settings';
import { Popup } from '../Popup';

export interface ThemeEditorInitial {
	editingId: string | null;
	name: string;
	colors: ThemeColors;
}

export interface ThemeEditorProps {
	isOpen: boolean;
	onClose: () => void;
	initial: ThemeEditorInitial | null;
	onSave: (theme: CustomTheme) => void;
}

const COLOR_FIELDS: (keyof ThemeColors)[] = ['background', 'panel', 'text', 'accent', 'border'];

interface ThemeEditorFormProps {
	initial: ThemeEditorInitial;
	onClose: () => void;
	onSave: (theme: CustomTheme) => void;
}

// Mounted only while the popup is open, so its state starts fresh every time.
function ThemeEditorForm({ initial, onClose, onSave }: ThemeEditorFormProps) {
	const { t } = useTranslation();
	const [name, setName] = useState(initial.name);
	const [colors, setColors] = useState(initial.colors);
	const canSave = name.trim().length > 0;

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();

		if (!canSave) {
			return;
		}

		onSave({ id: initial.editingId ?? generateId(), name: name.trim(), colors });
	};

	return (
		<form
			onSubmit={handleSubmit}
			className='flex flex-col gap-3'
		>
			<TextInput
				value={name}
				maxLength={MAX_THEME_NAME_LENGTH}
				aria-label={t('settings.editor.name')}
				onChange={(event) => setName(event.target.value)}
			>
				{t('settings.editor.name')}
			</TextInput>

			{COLOR_FIELDS.map((field) => (
				<ColorInput
					key={field}
					label={t(`settings.editor.${field}`)}
					value={colors[field]}
					onChange={(value) => setColors((previous) => ({ ...previous, [field]: value }))}
				/>
			))}

			<div
				className='border p-3'
				style={{
					backgroundColor: colors.background,
					color: colors.text,
					borderColor: colors.border,
				}}
			>
				<div
					className='mb-2 border p-3 text-sm'
					style={{ backgroundColor: colors.panel, borderColor: colors.border }}
				>
					{t('settings.editor.previewText')}
				</div>
				<span
					className='inline-block border px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider'
					style={{ borderColor: colors.accent, color: colors.accent }}
				>
					{t('settings.editor.previewButton')}
				</span>
			</div>

			{hasLowContrast(colors) && (
				<p
					role='alert'
					className='text-sm text-red-500'
				>
					{t('settings.editor.lowContrast')}
				</p>
			)}

			<div className='flex justify-end gap-2'>
				<button
					type='button'
					onClick={onClose}
					className='px-4 py-1.5 font-mono text-xs uppercase tracking-wide hover:bg-hover'
				>
					{t('settings.editor.cancel')}
				</button>
				<Button
					type='submit'
					disabled={!canSave}
				>
					{t('settings.editor.save')}
				</Button>
			</div>
		</form>
	);
}

export function ThemeEditor({ isOpen, onClose, initial, onSave }: ThemeEditorProps) {
	const { t } = useTranslation();

	return (
		<Popup
			isOpen={isOpen}
			onClose={onClose}
			title={
				initial?.editingId
					? t('settings.editor.editTitle')
					: t('settings.editor.createTitle')
			}
		>
			{initial && (
				<ThemeEditorForm
					initial={initial}
					onClose={onClose}
					onSave={onSave}
				/>
			)}
		</Popup>
	);
}
