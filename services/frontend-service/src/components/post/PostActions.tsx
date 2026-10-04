import { useTranslation } from 'react-i18next';
import type { FeedPost } from '@the-scroll/types';

// Post actions render as bracketed text, "[reply]" etc., in place of icon buttons — see the
// "Technical Ledger" style rule in CLAUDE.md.
const inertClass =
	'lowercase bg-none border-none p-0 font-mono text-inherit cursor-default disabled:opacity-60';
const actionClass =
	'lowercase bg-none border-none p-0 font-mono text-inherit cursor-pointer hover:underline pointer-events-auto';

export interface PostActionsProps {
	post: FeedPost;
	isSignedIn: boolean;
	isOwnPost: boolean;
	canModerate: boolean;
	isLiking: boolean;
	onReply: () => void;
	onLike: () => void;
	onShare: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onRemove: () => void;
}

/** The row under a post: reply, like, share, view count, and the owner's or moderator's actions. */
export function PostActions({
	post,
	isSignedIn,
	isOwnPost,
	canModerate,
	isLiking,
	onReply,
	onLike,
	onShare,
	onEdit,
	onDelete,
	onRemove,
}: PostActionsProps) {
	const { t } = useTranslation();

	return (
		<div className='relative pointer-events-none flex flex-wrap gap-x-5 gap-y-1 max-w-md text-xs text-muted'>
			<button
				type='button'
				data-action='reply'
				onClick={onReply}
				className={actionClass}
			>
				[{t('post.reply')}
				{post.replyCount > 0 ? ` ${post.replyCount}` : ''}]
			</button>
			{/* Repost is still a mock. */}
			<button
				type='button'
				disabled
				className={inertClass}
			>
				[{t('post.repost')}]
			</button>
			<button
				type='button'
				disabled={!isSignedIn || isLiking}
				aria-pressed={post.likedByMe}
				data-action='like'
				onClick={onLike}
				className={`${isSignedIn ? actionClass : inertClass} ${post.likedByMe ? 'text-accent' : ''}`}
			>
				[{t(post.likedByMe ? 'post.unlike' : 'post.like')}
				{post.likeCount > 0 ? ` ${post.likeCount}` : ''}]
			</button>
			<button
				type='button'
				data-action='share'
				onClick={onShare}
				className={actionClass}
			>
				[{t('post.share')}]
			</button>
			<span
				className='font-mono lowercase'
				title={t('post.views', { count: post.viewCount })}
			>
				[{t('post.viewsShort')} {post.viewCount}]
			</span>
			{isOwnPost && (
				<button
					type='button'
					onClick={onEdit}
					className={actionClass}
				>
					[{t('post.edit')}]
				</button>
			)}
			{canModerate && (
				<button
					type='button'
					onClick={onRemove}
					className={actionClass}
				>
					[{t('post.remove')}]
				</button>
			)}
			{isOwnPost && (
				<button
					type='button'
					onClick={onDelete}
					className={actionClass}
				>
					[{t('post.delete')}]
				</button>
			)}
		</div>
	);
}
