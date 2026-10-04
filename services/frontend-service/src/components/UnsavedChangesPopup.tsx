import { useTranslation } from 'react-i18next';
import { Button } from '../elements/Button';
import { Popup } from './Popup';

export interface UnsavedChangesPopupProps {
	isOpen: boolean;
	onStay: () => void;
	onLeave: () => void;
}

/** "Leave without saving?": shown when the user navigates away from a form with unsaved changes. */
export function UnsavedChangesPopup({ isOpen, onStay, onLeave }: UnsavedChangesPopupProps) {
	const { t } = useTranslation();

	return (
		<Popup
			isOpen={isOpen}
			onClose={onStay}
			title={t('unsaved.title')}
			footer={
				<>
					<Button
						type='button'
						onClick={onStay}
					>
						{t('unsaved.stay')}
					</Button>
					<Button
						type='button'
						onClick={onLeave}
					>
						{t('unsaved.leave')}
					</Button>
				</>
			}
		>
			<p className='text-sm text-muted'>{t('unsaved.hint')}</p>
		</Popup>
	);
}
