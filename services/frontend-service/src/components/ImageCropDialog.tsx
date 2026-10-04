import { useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { Button } from '../elements/Button';
import type { PixelArea } from '../scripts/crop';
import { Popup } from './Popup';

export interface ImageCropDialogProps {
	/** Object URL of the picked file; `null` keeps the dialog closed. */
	src: string | null;
	/** Width / height of the wanted cut-out. */
	aspect: number;
	title: string;
	isBusy?: boolean;
	onCancel: () => void;
	onConfirm: (area: PixelArea) => void;
}

export function ImageCropDialog({
	src,
	aspect,
	title,
	isBusy = false,
	onCancel,
	onConfirm,
}: ImageCropDialogProps) {
	const { t } = useTranslation();
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [area, setArea] = useState<Area | null>(null);

	return (
		<Popup
			isOpen={src !== null}
			onClose={onCancel}
			title={title}
		>
			<div className='relative h-72 bg-panel border border-line'>
				{src && (
					<Cropper
						image={src}
						crop={crop}
						zoom={zoom}
						aspect={aspect}
						onCropChange={setCrop}
						onZoomChange={setZoom}
						onCropComplete={(_visible, pixels) => setArea(pixels)}
						objectFit='contain'
					/>
				)}
			</div>

			<label className='flex items-center gap-3 font-mono text-xs uppercase tracking-wide text-muted'>
				{t('profileEditor.zoom')}
				<input
					type='range'
					min={1}
					max={4}
					step={0.05}
					value={zoom}
					onChange={(event) => setZoom(Number(event.target.value))}
					className='flex-1 accent-(--theme-accent)'
				/>
			</label>

			<div className='flex justify-end gap-2'>
				<Button
					type='button'
					onClick={onCancel}
					disabled={isBusy}
				>
					{t('profileEditor.cancel')}
				</Button>
				<Button
					type='button'
					disabled={!area || isBusy}
					onClick={() => area && onConfirm(area)}
				>
					{isBusy ? t('post.uploading') : t('profileEditor.apply')}
				</Button>
			</div>
		</Popup>
	);
}
