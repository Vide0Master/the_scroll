import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PROFILE_VISIBLE_NAME_MAX_LENGTH, type BannerGradient } from '@the-scroll/types';
import { Avatar } from '../../elements/Avatar';
import { Button } from '../../elements/Button';
import { FormField } from '../../elements/FormField';
import { TextInput } from '../../elements/TextInput';
import { useCurrentUser, type CurrentUser } from '../../providers/AuthContext';
import { useUnsavedGuard } from '../../scripts/useUnsavedGuard';
import { UnsavedChangesPopup } from '../UnsavedChangesPopup';
import { api, getApiError } from '../../scripts/api';
import { cropImage, fileNameFor, type PixelArea } from '../../scripts/crop';
import {
	dominantColors,
	gradientCss,
	gradientOptions,
	readImagePixels,
} from '../../scripts/palette';
import { ImageCropDialog } from '../ImageCropDialog';
import { ProfileBanner } from '../profile/ProfileBanner';

type BannerMode = 'none' | 'image' | 'gradient';
type CropTarget = { kind: 'avatar' | 'banner'; src: string };

const ACCEPTED_IMAGES = 'image/png,image/jpeg,image/webp,image/gif';
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const AVATAR_OUTPUT = { width: 512, height: 512 };
const BANNER_OUTPUT = { width: 1500, height: 500 };

const sectionTitleClass = 'font-mono text-sm uppercase tracking-widest text-muted';

function sameGradient(a: BannerGradient | null, b: BannerGradient | null): boolean {
	return a?.from === b?.from && a?.to === b?.to;
}

/** The "My profile" section: waits for the account, then shows the form filled from it. */
export function ProfileEditor() {
	const { t } = useTranslation();
	const { user, isLoading } = useCurrentUser();

	if (isLoading) {
		return <div className='m-4 h-48 bg-hover animate-pulse' />;
	}

	if (!user) {
		return <p className='p-4 text-sm text-muted'>{t('profileEditor.loginRequired')}</p>;
	}

	// Separate component so the form's initial state is read from a loaded account.
	return <ProfileForm user={user} />;
}

/** Display name, avatar, banner (picture or gradient from the avatar). */
function ProfileForm({ user }: { user: CurrentUser }) {
	const { t } = useTranslation();
	const { refresh } = useCurrentUser();
	const avatarInput = useRef<HTMLInputElement>(null);
	const bannerInput = useRef<HTMLInputElement>(null);

	const [visibleName, setVisibleName] = useState(user.visibleName ?? '');
	const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl ?? null);
	const [bannerUrl, setBannerUrl] = useState<string | null>(user.bannerUrl ?? null);
	const [gradient, setGradient] = useState<BannerGradient | null>(user.bannerGradient ?? null);
	const [mode, setMode] = useState<BannerMode>(
		user.bannerUrl ? 'image' : user.bannerGradient ? 'gradient' : 'none',
	);
	// Tagged with the avatar they were built from, so a stale result is never shown for a new one.
	const [computed, setComputed] = useState<{ forUrl: string; options: BannerGradient[] } | null>(
		null,
	);
	const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

	// Gradient suggestions come from the current avatar's colors; the server never sees them.
	useEffect(() => {
		let isActive = true;

		if (!avatarUrl) {
			return;
		}

		readImagePixels(avatarUrl)
			.then((pixels) => ({
				forUrl: avatarUrl,
				options: gradientOptions(dominantColors(pixels, 4)),
			}))
			.catch(() => ({ forUrl: avatarUrl, options: [] }))
			.then((result) => isActive && setComputed(result));

		return () => {
			isActive = false;
		};
	}, [avatarUrl]);

	const suggestions = computed && computed.forUrl === avatarUrl ? computed.options : [];

	const pickFile = (kind: CropTarget['kind'], file: File | undefined) => {
		if (!file) {
			return;
		}

		if (file.size > MAX_SOURCE_BYTES) {
			setMessage({
				kind: 'error',
				text: t('profileEditor.fileTooLarge', { max: MAX_SOURCE_BYTES / 1024 / 1024 }),
			});
			return;
		}

		setMessage(null);
		setCropTarget({ kind, src: URL.createObjectURL(file) });
	};

	const closeCrop = () => {
		if (cropTarget) {
			URL.revokeObjectURL(cropTarget.src);
		}

		setCropTarget(null);
	};

	const applyCrop = async (area: PixelArea) => {
		if (!cropTarget) {
			return;
		}

		setIsUploading(true);

		try {
			const isAvatar = cropTarget.kind === 'avatar';
			const blob = await cropImage(
				cropTarget.src,
				area,
				isAvatar ? AVATAR_OUTPUT : BANNER_OUTPUT,
				isAvatar ? 'image/png' : 'image/webp',
			);
			const file = new File([blob], fileNameFor(cropTarget.kind, blob), { type: blob.type });
			const uploaded = await api.media.upload(file);
			const url = uploaded.file?.url;

			if (!url) {
				throw new Error('Upload returned no file');
			}

			if (isAvatar) {
				setAvatarUrl(url);
			} else {
				setBannerUrl(url);
				setMode('image');
			}

			closeCrop();
		} catch {
			setMessage({ kind: 'error', text: t('profileEditor.uploadFailed') });
			closeCrop();
		} finally {
			setIsUploading(false);
		}
	};

	const options = [
		...(gradient && !suggestions.some((option) => sameGradient(option, gradient))
			? [gradient]
			: []),
		...suggestions,
	];

	const save = async () => {
		setIsSaving(true);
		setMessage(null);

		try {
			const data = await api.profile.update({
				visibleName: visibleName.trim() || null,
				avatarUrl,
				bannerUrl: mode === 'image' ? bannerUrl : null,
				bannerGradient: mode === 'gradient' ? gradient : null,
			});

			if (!data.success) {
				throw new Error('Rejected');
			}

			await refresh();
			setMessage({ kind: 'ok', text: t('profileEditor.saved') });
		} catch (error) {
			setMessage({
				kind: 'error',
				text:
					getApiError(error).code === 'invalidProfile'
						? t('profileEditor.invalid')
						: t('auth.errors.network'),
			});
		} finally {
			setIsSaving(false);
		}
	};

	const isGradientMissing = mode === 'gradient' && gradient === null;

	// Unsaved changes: what the form would save, compared with what the account has now.
	const isDirty =
		(visibleName.trim() || null) !== (user.visibleName ?? null) ||
		avatarUrl !== (user.avatarUrl ?? null) ||
		(mode === 'image' ? bannerUrl : null) !== (user.bannerUrl ?? null) ||
		!sameGradient(mode === 'gradient' ? gradient : null, user.bannerGradient ?? null);
	const guard = useUnsavedGuard(isDirty && !isSaving);
	const previewName = visibleName.trim() || user.userName;

	return (
		<div className='flex flex-col gap-6 p-4'>
			<section aria-label={t('profileEditor.preview')}>
				<div className='border border-line'>
					<ProfileBanner
						bannerUrl={mode === 'image' ? bannerUrl : null}
						bannerGradient={mode === 'gradient' ? gradient : null}
					/>
					<div className='px-4 pb-4'>
						<div
							className={`-mt-10 w-fit ${avatarUrl ? '' : 'border-4 border-surface bg-surface'}`}
						>
							<Avatar
								name={previewName}
								src={avatarUrl}
								size='xl'
							/>
						</div>
						<div className='mt-2 text-xl font-bold truncate'>{previewName}</div>
						<div className='font-mono text-muted truncate'>@{user.userName}</div>
					</div>
				</div>
			</section>

			<section className='flex flex-col gap-2'>
				<h2 className={sectionTitleClass}>{t('profileEditor.displayName')}</h2>
				<FormField>
					<TextInput
						value={visibleName}
						maxLength={PROFILE_VISIBLE_NAME_MAX_LENGTH}
						onChange={(event) => setVisibleName(event.target.value)}
					>
						{t('profileEditor.displayName')}
					</TextInput>
				</FormField>
			</section>

			<section className='flex flex-col gap-2'>
				<h2 className={sectionTitleClass}>{t('profileEditor.avatar')}</h2>
				<p className='text-sm text-muted'>{t('profileEditor.avatarHint')}</p>
				<div className='flex flex-wrap gap-2'>
					<Button
						type='button'
						onClick={() => avatarInput.current?.click()}
					>
						{t('profileEditor.uploadAvatar')}
					</Button>
					<Button
						type='button'
						disabled={!avatarUrl}
						onClick={() => setAvatarUrl(null)}
					>
						{t('profileEditor.removeAvatar')}
					</Button>
				</div>
				<input
					ref={avatarInput}
					type='file'
					accept={ACCEPTED_IMAGES}
					aria-label={t('profileEditor.uploadAvatar')}
					className='sr-only'
					onChange={(event) => {
						pickFile('avatar', event.target.files?.[0]);
						event.target.value = '';
					}}
				/>
			</section>

			<section className='flex flex-col gap-2'>
				<h2 className={sectionTitleClass}>{t('profileEditor.banner')}</h2>
				<div className='flex flex-wrap gap-2'>
					{(['none', 'image', 'gradient'] as const).map((option) => (
						<button
							key={option}
							type='button'
							aria-pressed={mode === option}
							onClick={() => setMode(option)}
							className={`px-3 py-1 font-mono text-xs uppercase tracking-wide border ${mode === option ? 'border-accent text-accent' : 'border-line text-muted hover:bg-hover'}`}
						>
							{t(`profileEditor.mode.${option}`)}
						</button>
					))}
				</div>

				{mode === 'image' && (
					<div className='flex flex-col gap-2'>
						<div>
							<Button
								type='button'
								onClick={() => bannerInput.current?.click()}
							>
								{t('profileEditor.uploadBanner')}
							</Button>
						</div>
						<input
							ref={bannerInput}
							type='file'
							accept={ACCEPTED_IMAGES}
							aria-label={t('profileEditor.uploadBanner')}
							className='sr-only'
							onChange={(event) => {
								pickFile('banner', event.target.files?.[0]);
								event.target.value = '';
							}}
						/>
					</div>
				)}

				{mode === 'gradient' &&
					(options.length === 0 ? (
						<p className='text-sm text-muted'>
							{t('profileEditor.gradientNeedsAvatar')}
						</p>
					) : (
						<div
							role='group'
							aria-label={t('profileEditor.gradients')}
							className='flex flex-wrap gap-2'
						>
							{options.map((option, index) => (
								<button
									key={`${option.from}${option.to}`}
									type='button'
									aria-label={t('profileEditor.gradientN', { index: index + 1 })}
									aria-pressed={sameGradient(option, gradient)}
									onClick={() => setGradient(option)}
									style={{ backgroundImage: gradientCss(option) }}
									className={`w-20 h-10 border-2 ${sameGradient(option, gradient) ? 'border-accent' : 'border-line'}`}
								/>
							))}
						</div>
					))}
			</section>

			{message && (
				<p
					role={message.kind === 'error' ? 'alert' : 'status'}
					className={`text-sm ${message.kind === 'error' ? 'text-red-500' : 'text-muted'}`}
				>
					{message.text}
				</p>
			)}

			<div>
				<Button
					type='button'
					disabled={isSaving || isUploading || isGradientMissing}
					onClick={save}
				>
					{isSaving ? '...' : t('profileEditor.save')}
				</Button>
			</div>

			<UnsavedChangesPopup
				isOpen={guard.isBlocked}
				onStay={guard.stay}
				onLeave={guard.leave}
			/>

			<ImageCropDialog
				src={cropTarget?.src ?? null}
				aspect={cropTarget?.kind === 'banner' ? 3 : 1}
				title={t(
					cropTarget?.kind === 'banner'
						? 'profileEditor.cropBanner'
						: 'profileEditor.cropAvatar',
				)}
				isBusy={isUploading}
				onCancel={closeCrop}
				onConfirm={applyCrop}
			/>
		</div>
	);
}
