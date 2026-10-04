import React, {
	useRef,
	useState,
	type ChangeEvent,
	type ClipboardEvent,
	type KeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { PhotoIcon } from '@heroicons/react/24/outline';
import type { FeedPost, UserProfile } from '@the-scroll/types';
import { Button } from '../elements/Button';
import { applyMention, findMentionQuery } from '../scripts/mentions';
import { useComposer } from '../scripts/useComposer';
import { useMentionSearch } from '../scripts/useMentionSearch';
import { useUnsavedGuard } from '../scripts/useUnsavedGuard';
import { MediaAttachments } from './MediaAttachments';
import { MentionSuggestions } from './MentionSuggestions';
import { UnsavedChangesPopup } from './UnsavedChangesPopup';

export interface CreatePostFormProps {
	// Create mode (default) when omitted; edit mode when set, prefilled from this post.
	editingPost?: FeedPost;
	// Reply mode: the new post answers this post.
	parentPostID?: string;
	autoFocus?: boolean;
	onPostCreated?: (post?: FeedPost) => void;
	onPostUpdated?: (post: FeedPost) => void;
}

export function CreatePostForm({
	editingPost,
	parentPostID,
	autoFocus = false,
	onPostCreated,
	onPostUpdated,
}: CreatePostFormProps) {
	const { t } = useTranslation();
	const composer = useComposer({ editingPost, parentPostID, onPostCreated, onPostUpdated });
	const { content, setContent, isEditing } = composer;
	const guard = useUnsavedGuard(composer.isDirty);

	// @name hints: the caret position decides whether one is being typed; Escape hides the
	// list for that "@" until another is started.
	const [caret, setCaret] = useState(0);
	const [highlighted, setHighlighted] = useState(0);
	const [dismissedAt, setDismissedAt] = useState<number | null>(null);

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const mention = findMentionQuery(content, caret);
	const suggestions = useMentionSearch(
		mention && mention.start !== dismissedAt ? mention.query : null,
	);
	const activeSuggestion = Math.min(highlighted, suggestions.length - 1);

	const handlePickMention = (picked: UserProfile) => {
		if (!mention) {
			return;
		}

		const next = applyMention(content, caret, mention.start, picked.userName);
		setContent(next.text);
		setCaret(next.caret);

		// The new caret can only be set once React has put the new text into the textarea.
		requestAnimationFrame(() => {
			textareaRef.current?.focus();
			textareaRef.current?.setSelectionRange(next.caret, next.caret);
		});
	};

	const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		// Ctrl/Cmd+Enter sends, like the button.
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			void composer.submit();
			return;
		}

		if (suggestions.length === 0 || !mention) {
			return;
		}

		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const step = event.key === 'ArrowDown' ? 1 : -1;
			setHighlighted((activeSuggestion + step + suggestions.length) % suggestions.length);
		} else if (event.key === 'Enter' || event.key === 'Tab') {
			event.preventDefault();
			handlePickMention(suggestions[activeSuggestion]);
		} else if (event.key === 'Escape') {
			// Closes only the hint list, not a popup this form may be in.
			event.preventDefault();
			event.stopPropagation();
			setDismissedAt(mention.start);
		}
	};

	const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.target.files ?? []);
		await composer.addFiles(files);

		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
	};

	// Pasting an image (a screenshot) attaches it; pasting text is left alone.
	const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
		const files = Array.from(event.clipboardData.files).filter(
			(file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
		);

		if (files.length > 0) {
			event.preventDefault();
			void composer.addFiles(files);
		}
	};

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		void composer.submit();
	};

	// The budget shows once the text is long enough to matter, and turns red past the limit.
	const showCounter = composer.used >= composer.max * 0.8;

	return (
		// In a popup the popup's own border closes the form, so the bottom line is left out there.
		<div className={`flex flex-col w-full ${isEditing ? '' : 'border-b border-line'}`}>
			<form
				onSubmit={handleSubmit}
				className='flex flex-col'
			>
				<div className='relative'>
					<textarea
						ref={textareaRef}
						value={content}
						onChange={(e) => {
							setContent(e.target.value);
							setCaret(e.target.selectionStart);
							setHighlighted(0);
						}}
						onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
						onKeyDown={handleTextareaKeyDown}
						onPaste={handlePaste}
						aria-autocomplete='list'
						aria-expanded={suggestions.length > 0}
						placeholder={t(parentPostID ? 'post.replyPlaceholder' : 'post.placeholder')}
						autoFocus={autoFocus}
						rows={3}
						className='w-full bg-transparent text-main placeholder:text-muted resize-none outline-none text-sm leading-relaxed px-5 py-4 border-none focus:ring-0'
					/>
					{suggestions.length > 0 && (
						<MentionSuggestions
							users={suggestions}
							activeIndex={activeSuggestion}
							onSelect={handlePickMention}
							onHover={setHighlighted}
						/>
					)}
				</div>

				<MediaAttachments
					urls={composer.mediaUrls}
					pending={composer.pending}
					onRemove={composer.removeMedia}
				/>

				{composer.errorMessage && (
					<div className='mx-4 mb-4 text-xs text-red-500 border border-red-500/40 px-3 py-2'>
						{composer.errorMessage}
					</div>
				)}

				<div className='flex items-center justify-between border-t border-line px-4 py-3'>
					<div className='flex items-center gap-2'>
						<input
							type='file'
							ref={fileInputRef}
							onChange={handleFileChange}
							multiple
							accept='image/*,video/mp4,video/webm,video/quicktime'
							disabled={!composer.canAttachMore}
							className='hidden'
						/>
						<button
							type='button'
							aria-label={t('post.attach')}
							disabled={composer.isSubmitting || !composer.canAttachMore}
							onClick={() => fileInputRef.current?.click()}
							className='p-2 text-accent hover:bg-hover transition-colors disabled:opacity-50'
						>
							<PhotoIcon
								className='w-5 h-5'
								strokeWidth={1.25}
							/>
						</button>
						{composer.isUploading && (
							<span className='text-xs text-muted animate-pulse'>
								{t('post.uploading')}
							</span>
						)}
					</div>

					<div className='flex items-center gap-3'>
						{showCounter && (
							<span
								aria-label={t('post.charsLeft', {
									left: composer.max - composer.used,
								})}
								className={`font-mono text-xs ${composer.isOverLimit ? 'text-red-500' : 'text-muted'}`}
							>
								{composer.max - composer.used}
							</span>
						)}
						<Button
							type='submit'
							disabled={!composer.canSubmit}
						>
							{composer.isSubmitting
								? t('post.posting')
								: isEditing
									? t('post.save')
									: t(parentPostID ? 'post.replyButton' : 'post.postButton')}
						</Button>
					</div>
				</div>
			</form>

			<UnsavedChangesPopup
				isOpen={guard.isBlocked}
				onStay={guard.stay}
				onLeave={guard.leave}
			/>
		</div>
	);
}
