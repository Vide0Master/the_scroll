import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FeedPost } from '@the-scroll/types';
import { Avatar } from '../elements/Avatar';
import { useCurrentUser } from '../providers/AuthContext';
import { useToast } from '../providers/ToastContext';
import { copyText } from '../scripts/clipboard';
import { postPath, profilePath } from '../scripts/routes';
import { formatFull, formatPostDate, useNow } from '../scripts/time';
import { usePostReactions } from '../scripts/usePostReactions';
import { CreatePostForm } from './CreatePostForm';
import { Popup } from './Popup';
import { PostActions } from './post/PostActions';
import { PostBody } from './post/PostBody';
import { PostRemovalPopups } from './post/PostRemovalPopups';

export interface PostCardProps {
	post: FeedPost;
	/** The post is already open: no hover highlight and no whole-card link to itself. */
	isOpened?: boolean;
	/** Called with the new state after the post changes here (edited, deleted, liked). */
	onChange?: (post: FeedPost) => void;
}

export function PostCard({ post: initialPost, isOpened = false, onChange }: PostCardProps) {
	const { t, i18n } = useTranslation();
	const { user } = useCurrentUser();
	const { show } = useToast();
	const navigate = useNavigate();
	const now = useNow();
	// Own edits are applied locally so a save doesn't need to reload the whole feed/profile list.
	const [post, setPost] = useState(initialPost);
	const [isEditing, setIsEditing] = useState(false);
	const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
	const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);
	const { articleRef, isLiking, toggleLike } = usePostReactions(post, setPost, user);
	const { author, authorID, createdAt } = post;

	// A list that keeps its posts (see `useInfiniteList`) learns of edits, deletions and likes made
	// on this card, so coming back to it does not show the old version.
	useEffect(() => {
		if (post !== initialPost) {
			onChange?.(post);
		}
		// Only a change of this card's own state is reported, not a new prop or callback.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [post]);

	// A deleted post shows a neutral placeholder instead of its author (the server sends none).
	const displayName = post.isDeleted
		? t('post.deletedAuthor')
		: author?.visibleName || author?.userName || authorID.slice(0, 8);
	const usernameTag = post.isDeleted
		? '@deleted'
		: `@${author?.userName ?? authorID.slice(0, 8)}`;
	const profileLink = author && !post.isDeleted ? profilePath(author.userName) : null;
	const isOwnPost = user?.userID === authorID;
	// Moderators and admins can remove other people's posts (the server checks the role too).
	const canModerate =
		!isOwnPost &&
		(user?.roles.some((role) => role === 'ADMIN' || role === 'MODERATOR') ?? false);

	const handleShare = async () => {
		const isCopied = await copyText(`${window.location.origin}${postPath(post.postID)}`);
		show(
			isCopied
				? { kind: 'success', message: t('toast.linkCopied') }
				: { kind: 'error', message: t('toast.copyFailed') },
		);
	};

	const handleUpdated = (updated: FeedPost) => {
		// The update response has no resolved author; keep the one we already know about.
		setPost({ ...updated, author: post.author });
		setIsEditing(false);
	};

	return (
		<article
			ref={articleRef}
			data-post-id={post.postID}
			// Focusable by the j/k shortcuts (not by Tab: the card's own links and buttons are).
			tabIndex={-1}
			className={`relative outline-none focus:bg-hover focus-visible:shadow-[inset_2px_0_0_var(--color-accent)] flex flex-col gap-2 px-4 py-3 border-b border-line ${isOpened ? '' : 'hover:bg-hover transition-colors'}`}
		>
			{/*
			 * "Stretched link": an invisible link covering the whole card, placed first so every
			 * other element (painted after it) sits on top and keeps its own click behavior —
			 * avatar/name go to the profile, images open the lightbox, buttons act as buttons.
			 * Wrappers are pointer-events-none and interactive children opt back in with
			 * pointer-events-auto, so only those (and disabled mocks) intercept clicks; everything
			 * else (padding, text, gaps, the @handle, date) falls through to this link. Real <a>,
			 * so it's keyboard-focusable and works with ctrl/cmd-click — unlike an onClick on a
			 * plain <article>, which the project's own accessibility rule rules out.
			 */}
			{!isOpened && (
				<Link
					to={postPath(post.postID)}
					aria-label={t('post.viewPost', { name: displayName })}
					className='absolute inset-0'
				/>
			)}

			<div className='relative pointer-events-none flex items-center gap-3 min-w-0'>
				{profileLink ? (
					<Link
						to={profileLink}
						aria-label={displayName}
						className='pointer-events-auto'
					>
						<Avatar
							name={displayName}
							src={author?.avatarUrl}
						/>
					</Link>
				) : (
					<Avatar
						name={displayName}
						src={author?.avatarUrl}
					/>
				)}

				<div className='flex flex-col min-w-0 leading-tight font-mono text-xs'>
					{profileLink ? (
						<Link
							to={profileLink}
							className='pointer-events-auto self-start max-w-full font-semibold uppercase tracking-wide truncate hover:underline'
						>
							{displayName}
						</Link>
					) : (
						<span className='font-semibold uppercase tracking-wide truncate'>
							{displayName}
						</span>
					)}
					<span className='text-muted truncate'>{usernameTag}</span>
				</div>

				<time
					dateTime={new Date(createdAt).toISOString()}
					title={formatFull(createdAt, i18n.language)}
					className='ml-auto shrink-0 font-mono text-xs text-muted whitespace-nowrap'
				>
					{formatPostDate(createdAt, i18n.language, now)}
				</time>
			</div>

			<PostBody
				post={post}
				isOpened={isOpened}
			/>

			{!post.isDeleted && (
				<PostActions
					post={post}
					isSignedIn={!!user}
					isOwnPost={isOwnPost}
					canModerate={canModerate}
					isLiking={isLiking}
					onReply={() => navigate(postPath(post.postID), { state: { focusReply: true } })}
					onLike={toggleLike}
					onShare={handleShare}
					onEdit={() => setIsEditing(true)}
					onDelete={() => setIsConfirmingDelete(true)}
					onRemove={() => setIsConfirmingRemoval(true)}
				/>
			)}

			{isOwnPost && (
				<Popup
					isOpen={isEditing}
					onClose={() => setIsEditing(false)}
					title={t('post.edit')}
					isFlush
				>
					<CreatePostForm
						editingPost={post}
						onPostUpdated={handleUpdated}
					/>
				</Popup>
			)}

			<PostRemovalPopups
				post={post}
				isDeleteOpen={isOwnPost && isConfirmingDelete}
				isRemoveOpen={canModerate && isConfirmingRemoval}
				onCloseDelete={() => setIsConfirmingDelete(false)}
				onCloseRemove={() => setIsConfirmingRemoval(false)}
				onChanged={setPost}
			/>
		</article>
	);
}
