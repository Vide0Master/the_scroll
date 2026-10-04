import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FeedPost } from '@the-scroll/types';
import { CreatePostForm } from '../../../components/CreatePostForm';
import { GuestActions } from '../../../components/GuestActions';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PostCard } from '../../../components/PostCard';
import { PostList } from '../../../components/PostList';
import { useCurrentUser } from '../../../providers/AuthContext';
import { api, getApiError } from '../../../scripts/api';
import { usePostList } from '../../../scripts/useInfiniteList';

type ThreadState =
	| { status: 'notFound' }
	| { status: 'error' }
	| { status: 'ready'; post: FeedPost; ancestors: FeedPost[] };

async function loadThread(postID: string): Promise<ThreadState> {
	try {
		const thread = await api.posts.getById(postID);

		if (!thread.post) {
			return { status: 'notFound' };
		}

		return {
			status: 'ready',
			post: thread.post,
			ancestors: thread.ancestors ?? [],
		};
	} catch (error) {
		return { status: getApiError(error).status === 404 ? 'notFound' : 'error' };
	}
}

/** A post with the chain it answers above it, a reply box, and its direct replies below. */
export default function PostDetail() {
	const { t } = useTranslation();
	const { user } = useCurrentUser();
	const { postID = '' } = useParams<{ postID: string }>();
	const location = useLocation();
	const [result, setResult] = useState<{ forPostID: string; state: ThreadState } | null>(null);
	// Bumped after a reply is posted: reloads the thread (new reply, updated counter).
	const [version, setVersion] = useState(0);

	// Set by the [reply] button of a card: land with the reply box focused.
	const shouldFocusReply =
		(location.state as { focusReply?: boolean } | null)?.focusReply === true;

	useEffect(() => {
		let isActive = true;

		loadThread(postID).then((state) => {
			if (isActive) {
				setResult({ forPostID: postID, state });
			}
		});

		return () => {
			isActive = false;
		};
	}, [postID, version]);

	// A result loaded for a previously viewed post counts as "still loading".
	const view = result?.forPostID === postID ? result.state : null;

	// Replies page in as the end scrolls into view.
	const replies = usePostList(`replies:${postID}`, (cursor) =>
		api.posts.getReplies(postID, cursor),
	);
	const reloadReplies = replies.reload;

	return (
		<>
			<PageHeader title={t('nav.post')} />

			{view === null && <div className='h-48 bg-hover animate-pulse' />}

			{view?.status === 'notFound' && (
				<div className='p-8 text-center text-muted'>{t('post.notFound')}</div>
			)}

			{view?.status === 'error' && (
				<div className='p-8 text-center text-red-500'>{t('post.loadError')}</div>
			)}

			{view?.status === 'ready' && (
				<>
					{view.ancestors.map((ancestor) => (
						<PostCard
							key={ancestor.postID}
							post={ancestor}
						/>
					))}

					{/* Remounted when the counter changes: a card keeps its own copy of the post. */}
					<PostCard
						key={`${view.post.postID}:${view.post.replyCount}`}
						post={view.post}
						isOpened
					/>

					{view.post.isDeleted ? (
						<p className='p-4 text-sm text-muted border-b border-line'>
							{t('post.replyToDeleted')}
						</p>
					) : user ? (
						<CreatePostForm
							parentPostID={view.post.postID}
							autoFocus={shouldFocusReply}
							onPostCreated={() => {
								setVersion((current) => current + 1);
								reloadReplies();
							}}
						/>
					) : (
						<div className='flex flex-col items-center gap-3 p-4 border-b border-line'>
							<p className='text-sm text-muted'>{t('post.loginToReply')}</p>
							<GuestActions />
						</div>
					)}

					<h2 className='px-4 pt-4 font-mono text-sm uppercase tracking-widest text-muted'>
						{t('post.replies')}
					</h2>

					<PostList
						list={replies}
						emptyText={t('post.noReplies')}
						errorText={t('post.loadError')}
					/>
				</>
			)}
		</>
	);
}
