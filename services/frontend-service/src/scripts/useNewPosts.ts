import { useEffect, useState } from 'react';
import type { FeedPost } from '@the-scroll/types';

const POLL_MS = 60 * 1000;

/**
 * How many posts appeared above the first one of a list since it was loaded ("show 3 new posts").
 * Asks `fetchLatest` (the first page) once a minute while the tab is visible, and right away when
 * it becomes visible again. The count is tied to the post the list starts with: once the list
 * reloads or gets a post of its own on top, the old count no longer applies.
 */
export function useNewPosts(
	items: FeedPost[],
	fetchLatest: () => Promise<FeedPost[]>,
): { count: number; isMore: boolean } {
	const firstID = items[0]?.postID;
	const [found, setFound] = useState<{ forID: string; count: number; isMore: boolean } | null>(
		null,
	);

	useEffect(() => {
		if (!firstID) {
			return;
		}

		let isActive = true;

		const check = async () => {
			if (document.visibilityState !== 'visible') {
				return;
			}

			try {
				const latest = await fetchLatest();
				const index = latest.findIndex((post) => post.postID === firstID);

				if (isActive) {
					// Not found among the first page: at least that many, maybe more.
					setFound({
						forID: firstID,
						count: index === -1 ? latest.length : index,
						isMore: index === -1 && latest.length > 0,
					});
				}
			} catch {
				/* the banner is a nicety: try again next time */
			}
		};

		const timer = setInterval(check, POLL_MS);
		document.addEventListener('visibilitychange', check);

		return () => {
			isActive = false;
			clearInterval(timer);
			document.removeEventListener('visibilitychange', check);
		};
		// `fetchLatest` changes every render; the poll only restarts with the list's first post.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [firstID]);

	return found && found.forID === firstID
		? { count: found.count, isMore: found.isMore }
		: { count: 0, isMore: false };
}
