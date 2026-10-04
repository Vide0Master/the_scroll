import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface InfiniteSentinelProps {
	hasMore: boolean;
	isLoading: boolean;
	hasFailed: boolean;
	onLoadMore: () => void;
	/** Changes whenever items were added, so a sentinel that is still on screen fires again. */
	itemCount: number;
}

/**
 * The end of an endless list: calls `onLoadMore` shortly before it scrolls into view. After a
 * failure it stops on its own and offers a retry instead of hammering the server.
 */
export function InfiniteSentinel({
	hasMore,
	isLoading,
	hasFailed,
	onLoadMore,
	itemCount,
}: InfiniteSentinelProps) {
	const { t } = useTranslation();
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const node = ref.current;

		if (!hasMore || hasFailed || !node || typeof IntersectionObserver === 'undefined') {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					onLoadMore();
				}
			},
			{ rootMargin: '600px 0px' },
		);
		observer.observe(node);

		return () => observer.disconnect();
	}, [hasMore, hasFailed, onLoadMore, itemCount]);

	if (!hasMore && !hasFailed) {
		return null;
	}

	return (
		<div
			ref={ref}
			className='p-4 text-center font-mono text-xs text-muted'
		>
			{hasFailed ? (
				<button
					type='button'
					onClick={onLoadMore}
					className='bg-none border-none p-0 font-mono text-inherit hover:underline'
				>
					{t('feed.loadMoreFailed')}
				</button>
			) : (
				isLoading && t('feed.loadingMore')
			)}
		</div>
	);
}
