import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { FeedPost } from '@the-scroll/types';
import { scrollPositionOf, type InfiniteList } from '../scripts/useInfiniteList';
import { InfiniteSentinel } from './InfiniteSentinel';
import { PostCard } from './PostCard';

export interface PostListProps {
	list: InfiniteList<FeedPost>;
	/** Shown when the list is empty. */
	emptyText: string;
	/** Shown when the first page could not be loaded. */
	errorText: string;
	/** Adjusts each post before it is shown (a profile fills in the author the server left out). */
	decorate?: (post: FeedPost) => FeedPost;
}

/**
 * The shared body of every list of posts: placeholder while loading, empty and error states with
 * a retry, the cards, and the end-of-list trigger that loads the next page. Puts the page back
 * where it was scrolled to when the list is shown again.
 */
export function PostList({ list, emptyText, errorText, decorate }: PostListProps) {
	const { t } = useTranslation();
	const { items, isLoading, isLoadingMore, hasMore, hasFailed, loadMore, reload, patch, key } =
		list;
	const isRestored = useRef<string | null>(null);

	// Once per list: back to the remembered position (top for a list shown for the first time).
	useLayoutEffect(() => {
		if (!isLoading && isRestored.current !== key) {
			isRestored.current = key;
			window.scrollTo(0, scrollPositionOf(key));
		}
	}, [isLoading, key]);

	if (isLoading && items.length === 0) {
		return (
			<div className='flex flex-col'>
				<div className='h-32 border-b border-line bg-hover animate-pulse' />
				<div className='h-40 border-b border-line bg-hover animate-pulse' />
			</div>
		);
	}

	if (items.length === 0) {
		return hasFailed ? (
			<div className='flex flex-col items-center gap-2 p-8 text-center text-sm text-red-500'>
				{errorText}
				<button
					type='button'
					onClick={reload}
					className='bg-none border-none p-0 font-mono text-xs uppercase text-accent hover:underline'
				>
					{t('common.retry')}
				</button>
			</div>
		) : (
			<div className='p-8 text-center text-sm text-muted'>{emptyText}</div>
		);
	}

	return (
		<>
			{items.map((post) => (
				<PostCard
					key={post.postID}
					post={decorate ? decorate(post) : post}
					onChange={(changed) => patch(changed.postID, () => changed)}
				/>
			))}
			<InfiniteSentinel
				hasMore={hasMore}
				isLoading={isLoadingMore}
				hasFailed={hasFailed}
				onLoadMore={loadMore}
				itemCount={items.length}
			/>
		</>
	);
}
