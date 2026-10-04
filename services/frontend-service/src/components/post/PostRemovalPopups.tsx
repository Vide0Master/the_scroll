import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BAN_REASON_MAX_LENGTH, type FeedPost } from '@the-scroll/types';
import { Button } from '../../elements/Button';
import { TextInput } from '../../elements/TextInput';
import { useToast } from '../../providers/ToastContext';
import { api } from '../../scripts/api';
import { Popup } from '../Popup';

/** What a deleted post keeps: the server clears text, media and author, so the card mirrors it. */
const asDeleted = (post: FeedPost, byModerator: boolean): FeedPost => ({
	...post,
	authorID: '',
	author: null,
	content: '',
	media: [],
	isDeleted: true,
	...(byModerator ? { removedByModerator: true } : {}),
});

export interface PostRemovalPopupsProps {
	post: FeedPost;
	/** Confirm deleting one's own post. */
	isDeleteOpen: boolean;
	/** Confirm removing someone else's post as a moderator. */
	isRemoveOpen: boolean;
	onCloseDelete: () => void;
	onCloseRemove: () => void;
	onChanged: (post: FeedPost) => void;
}

/** The two confirmations for taking a post down: the author deleting, a moderator removing. */
export function PostRemovalPopups({
	post,
	isDeleteOpen,
	isRemoveOpen,
	onCloseDelete,
	onCloseRemove,
	onChanged,
}: PostRemovalPopupsProps) {
	const { t } = useTranslation();
	const { show } = useToast();
	const [isBusy, setIsBusy] = useState(false);
	const [hasFailed, setHasFailed] = useState(false);
	const [reason, setReason] = useState('');

	const run = async (action: () => Promise<unknown>, byModerator: boolean, close: () => void) => {
		setIsBusy(true);
		setHasFailed(false);

		try {
			await action();
			onChanged(asDeleted(post, byModerator));
			close();
			setReason('');
			show({ kind: 'success', message: t(byModerator ? 'toast.removed' : 'toast.deleted') });
		} catch {
			setHasFailed(true);
		} finally {
			setIsBusy(false);
		}
	};

	return (
		<>
			<Popup
				isOpen={isDeleteOpen && !post.isDeleted}
				onClose={onCloseDelete}
				title={t('post.deleteTitle')}
				footer={
					<div className='flex justify-end gap-3'>
						<Button
							type='button'
							onClick={onCloseDelete}
						>
							{t('post.deleteCancel')}
						</Button>
						<Button
							type='button'
							disabled={isBusy}
							onClick={() =>
								run(() => api.posts.remove(post.postID), false, onCloseDelete)
							}
						>
							{isBusy ? t('post.deleting') : t('post.deleteConfirm')}
						</Button>
					</div>
				}
			>
				<p className='text-sm text-muted'>{t('post.deleteHint')}</p>
				{hasFailed && <p className='mt-2 text-sm text-red-500'>{t('post.deleteError')}</p>}
			</Popup>

			<Popup
				isOpen={isRemoveOpen && !post.isDeleted}
				onClose={onCloseRemove}
				title={t('post.removeTitle')}
				footer={
					<>
						<Button
							type='button'
							onClick={onCloseRemove}
						>
							{t('post.deleteCancel')}
						</Button>
						<Button
							type='button'
							disabled={isBusy}
							onClick={() =>
								run(
									() => api.posts.moderate(post.postID, reason.trim()),
									true,
									onCloseRemove,
								)
							}
						>
							{isBusy ? t('post.removing') : t('post.removeConfirm')}
						</Button>
					</>
				}
			>
				<p className='text-sm text-muted'>{t('post.removeHint')}</p>
				<TextInput
					value={reason}
					onChange={(event) => setReason(event.target.value)}
					maxLength={BAN_REASON_MAX_LENGTH}
					placeholder={t('post.removeReason')}
					className='mt-3'
				/>
				{hasFailed && <p className='mt-2 text-sm text-red-500'>{t('post.removeError')}</p>}
			</Popup>
		</>
	);
}
