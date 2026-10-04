import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CustomTheme, ThemeColors } from '@the-scroll/types';
import { SettingsSection } from '../../../components/layout/SettingsSection';
import { ThemeCard } from '../../../components/settings/ThemeCard';
import { ThemeEditor, type ThemeEditorInitial } from '../../../components/settings/ThemeEditor';
import { Button } from '../../../elements/Button';
import { useCurrentUser } from '../../../providers/AuthContext';
import { useTheme } from '../../../providers/ThemeContext';
import { MAX_CUSTOM_THEMES, MAX_THEME_NAME_LENGTH } from '../../../scripts/settings';
import { BUILT_IN_THEMES, BUILT_IN_THEME_IDS, resolveThemeColors } from '../../../scripts/themes';

const actionClass =
	'px-2 py-1 font-mono text-[11px] uppercase tracking-wide hover:bg-hover disabled:opacity-40';
const sectionTitleClass = 'mb-3 font-mono text-sm uppercase tracking-widest text-muted';

export default function ThemeSettings() {
	const { t } = useTranslation();
	const { user } = useCurrentUser();
	const { themeId, customThemes, selectTheme, saveCustomTheme, deleteCustomTheme, hasSaveError } =
		useTheme();
	const [editor, setEditor] = useState<ThemeEditorInitial | null>(null);

	const activeColors = resolveThemeColors(themeId, customThemes).colors;
	const isLimitReached = customThemes.length >= MAX_CUSTOM_THEMES;

	const closeEditor = useCallback(() => setEditor(null), []);

	const openDuplicate = (name: string, colors: ThemeColors) =>
		setEditor({
			editingId: null,
			name: t('settings.copyOf', { name }).slice(0, MAX_THEME_NAME_LENGTH),
			colors,
		});

	const handleSave = (theme: CustomTheme) => {
		saveCustomTheme(theme, { select: true });
		setEditor(null);
	};

	return (
		<SettingsSection title={t('settings.sections.theme')}>
			{hasSaveError && (
				<p
					role='alert'
					className='mx-4 mt-4 text-sm text-red-500'
				>
					{t('settings.saveError')}
				</p>
			)}
			{!user && <p className='mx-4 mt-4 text-sm text-muted'>{t('settings.guestNotice')}</p>}

			<section className='p-4'>
				<h2 className={sectionTitleClass}>{t('settings.builtInTitle')}</h2>
				<div className='grid grid-cols-2 gap-3'>
					{BUILT_IN_THEME_IDS.map((id) => (
						<ThemeCard
							key={id}
							name={t(`themes.${id}`)}
							colors={BUILT_IN_THEMES[id]}
							isActive={themeId === id}
							onSelect={() => selectTheme(id)}
							actions={
								<button
									type='button'
									disabled={isLimitReached}
									onClick={() =>
										openDuplicate(t(`themes.${id}`), BUILT_IN_THEMES[id])
									}
									className={actionClass}
								>
									{t('settings.duplicate')}
								</button>
							}
						/>
					))}
				</div>
			</section>

			<section className='p-4 border-t border-line'>
				<h2 className={sectionTitleClass}>{t('settings.customTitle')}</h2>

				{customThemes.length === 0 ? (
					<p className='mb-3 text-sm text-muted'>{t('settings.noCustom')}</p>
				) : (
					<div className='mb-3 grid grid-cols-2 gap-3'>
						{customThemes.map((theme) => (
							<ThemeCard
								key={theme.id}
								name={theme.name}
								colors={theme.colors}
								isActive={themeId === theme.id}
								onSelect={() => selectTheme(theme.id)}
								actions={
									<>
										<button
											type='button'
											onClick={() =>
												setEditor({
													editingId: theme.id,
													name: theme.name,
													colors: theme.colors,
												})
											}
											className={actionClass}
										>
											{t('settings.edit')}
										</button>
										<button
											type='button'
											disabled={isLimitReached}
											onClick={() => openDuplicate(theme.name, theme.colors)}
											className={actionClass}
										>
											{t('settings.duplicate')}
										</button>
										<button
											type='button'
											onClick={() => deleteCustomTheme(theme.id)}
											className={actionClass}
										>
											{t('settings.delete')}
										</button>
									</>
								}
							/>
						))}
					</div>
				)}

				<Button
					disabled={isLimitReached}
					onClick={() => setEditor({ editingId: null, name: '', colors: activeColors })}
				>
					{t('settings.createTheme')}
				</Button>
				{isLimitReached && (
					<p className='mt-2 text-sm text-muted'>
						{t('settings.limitReached', { max: MAX_CUSTOM_THEMES })}
					</p>
				)}
			</section>

			<ThemeEditor
				isOpen={editor !== null}
				onClose={closeEditor}
				initial={editor}
				onSave={handleSave}
			/>
		</SettingsSection>
	);
}
