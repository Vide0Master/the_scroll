import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	MEDIA_MAX_FILE_SIZE_BYTES,
	POST_CONTENT_MAX_LENGTH,
	POST_MEDIA_MAX_FILES,
	type FeedPost,
} from '@the-scroll/types';
import type { PendingUpload } from '../components/MediaAttachments';
import { useCurrentUser } from '../providers/AuthContext';
import { useToast } from '../providers/ToastContext';
import { api } from './api';
import { selectFilesWithinLimit } from './media';
import { postPath } from './routes';
import { readJSON, removeItem, writeJSON } from './storage';

const MAX_FILE_SIZE_MB = Math.round(MEDIA_MAX_FILE_SIZE_BYTES / (1024 * 1024));

const isString = (value: unknown): value is string => typeof value === 'string';

export interface ComposerOptions {
	/** Edit mode when set: prefilled from this post, nothing is drafted. */
	editingPost?: FeedPost;
	/** Reply mode: the new post answers this post. */
	parentPostID?: string;
	onPostCreated?: (post?: FeedPost) => void;
	onPostUpdated?: (post: FeedPost) => void;
}

/**
 * The state and actions behind the post form: text (kept as a draft per place: a new post, or a
 * reply to one post), attachments with previews while they upload, the character budget and the
 * submit. The form component only lays it out.
 */
export function useComposer({
	editingPost,
	parentPostID,
	onPostCreated,
	onPostUpdated,
}: ComposerOptions) {
	const { t } = useTranslation();
	const { user } = useCurrentUser();
	const { show } = useToast();
	const isEditing = editingPost !== undefined;
	const draftKey = isEditing ? null : `draft:${parentPostID ? `reply:${parentPostID}` : 'new'}`;

	const [content, setContent] = useState(
		() => editingPost?.content ?? (draftKey ? readJSON(draftKey, '', isString) : ''),
	);
	const [mediaUrls, setMediaUrls] = useState<string[]>(editingPost?.media ?? []);
	const [pending, setPending] = useState<PendingUpload[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const nextUploadID = useRef(1);

	// The text is remembered as it is typed, so closing the tab or leaving the page loses nothing.
	useEffect(() => {
		if (!draftKey) {
			return;
		}

		if (content) {
			writeJSON(draftKey, content);
		} else {
			removeItem(draftKey);
		}
	}, [draftKey, content]);

	const [hadDraft] = useState(() => !isEditing && content.trim().length > 0);

	useEffect(() => {
		if (hadDraft) {
			show({
				kind: 'info',
				message: t('toast.draftRestored'),
				action: { label: t('toast.discard'), onClick: () => setContent('') },
			});
		}
		// Once, when the form opens with a draft in it.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const addFiles = useCallback(
		async (files: File[]) => {
			if (files.length === 0) {
				return;
			}

			setErrorMessage(null);

			const { accepted, rejectedForCount, rejectedForSize } = selectFilesWithinLimit(
				mediaUrls.length + pending.length,
				files,
				POST_MEDIA_MAX_FILES,
				MEDIA_MAX_FILE_SIZE_BYTES,
			);

			if (rejectedForSize.length > 0) {
				setErrorMessage(
					t('post.fileTooLarge', {
						name: rejectedForSize[0].name,
						max: MAX_FILE_SIZE_MB,
					}),
				);
			} else if (rejectedForCount.length > 0) {
				setErrorMessage(t('post.tooManyFiles', { max: POST_MEDIA_MAX_FILES }));
			}

			const uploads = accepted.map((file) => ({
				file,
				preview: {
					id: String(nextUploadID.current++),
					name: file.name,
					previewUrl: URL.createObjectURL(file),
					isVideo: file.type.startsWith('video/'),
				} satisfies PendingUpload,
			}));

			setPending((current) => [...current, ...uploads.map((upload) => upload.preview)]);

			for (const { file, preview } of uploads) {
				try {
					const response = await api.media.upload(file);

					if (response.success && response.file) {
						const url = response.file.url;
						setMediaUrls((current) => [...current, url]);
					} else {
						setErrorMessage(
							response.errorDetails?.description || 'Failed to upload media file',
						);
					}
				} catch {
					setErrorMessage('Network error while uploading file');
				} finally {
					URL.revokeObjectURL(preview.previewUrl);
					setPending((current) => current.filter((item) => item.id !== preview.id));
				}
			}
		},
		[mediaUrls.length, pending.length, t],
	);

	const removeMedia = useCallback((index: number) => {
		setMediaUrls((current) => current.filter((_, i) => i !== index));
	}, []);

	const trimmedLength = content.trim().length;
	const isOverLimit = trimmedLength > POST_CONTENT_MAX_LENGTH;
	const isUploading = pending.length > 0;
	const hasContent = trimmedLength > 0 || mediaUrls.length > 0;
	const canSubmit = hasContent && !isOverLimit && !isSubmitting && !isUploading;

	// Nothing is lost by leaving a new post (its text is a draft), but an edit or an attachment
	// that was already uploaded would be.
	const isDirty = isEditing
		? content.trim() !== editingPost.content.trim() ||
			mediaUrls.join('|') !== editingPost.media.join('|')
		: mediaUrls.length > 0 || isUploading;

	const submit = async () => {
		if (!canSubmit) {
			return;
		}

		setIsSubmitting(true);
		setErrorMessage(null);

		const fail = (fallback: string, description?: string) => {
			const message = description || fallback;
			setErrorMessage(message);
			show({
				kind: 'error',
				message,
				action: { label: t('common.retry'), onClick: () => retryRef.current() },
			});
		};

		try {
			if (editingPost) {
				const response = await api.posts.update(editingPost.postID, {
					content: content.trim(),
					mediaUrls,
				});

				if (response.success && response.post) {
					onPostUpdated?.(response.post);
					show({ kind: 'success', message: t('toast.updated') });
				} else {
					fail('Could not save post', response.errorDetails?.description);
				}
			} else {
				const response = await api.posts.create({
					content: content.trim(),
					mediaUrls,
					parentPostID,
				});

				if (response.success) {
					setContent('');
					setMediaUrls([]);
					// The server leaves the author out of its answer; a list needs it to show the card.
					const created =
						response.post && user
							? {
									...response.post,
									author: {
										userID: user.userID,
										userName: user.userName,
										visibleName: user.visibleName,
										avatarUrl: user.avatarUrl,
									},
								}
							: response.post;

					onPostCreated?.(created);
					show({
						kind: 'success',
						message: t(parentPostID ? 'toast.replied' : 'toast.posted'),
						to: created ? postPath(created.postID) : undefined,
					});
				} else {
					fail('Could not create post', response.errorDetails?.description);
				}
			}
		} catch {
			fail('Failed to send post request');
		} finally {
			setIsSubmitting(false);
		}
	};

	// The Retry button of an error toast runs whatever the latest submit is by then.
	const retryRef = useRef<() => void>(() => undefined);

	useEffect(() => {
		retryRef.current = () => void submit();
	});

	return {
		content,
		setContent,
		mediaUrls,
		pending,
		errorMessage,
		isEditing,
		isSubmitting,
		isUploading,
		isOverLimit,
		isDirty,
		canSubmit,
		/** Characters typed (trimmed) out of the allowed maximum. */
		used: trimmedLength,
		max: POST_CONTENT_MAX_LENGTH,
		canAttachMore: mediaUrls.length + pending.length < POST_MEDIA_MAX_FILES,
		addFiles,
		removeMedia,
		submit,
	};
}
