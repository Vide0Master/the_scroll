import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { FeedPost } from '@the-scroll/types';
import type { CurrentUser } from '../providers/AuthContext';
import { useToast } from '../providers/ToastContext';
import { useTranslation } from 'react-i18next';
import { api } from './api';

/**
 * Likes (optimistic: the count flips at once and is settled by the server's answer, or rolled
 * back with a notice) and views (recorded once the card is on screen, for signed-in readers other
 * than the author; the server ignores the rest too, this only saves the request).
 */
export function usePostReactions(
	post: FeedPost,
	setPost: Dispatch<SetStateAction<FeedPost>>,
	user: CurrentUser | null,
) {
	const { t } = useTranslation();
	const { show } = useToast();
	const [isLiking, setIsLiking] = useState(false);
	const articleRef = useRef<HTMLElement>(null);

	const shouldCountView = !!user && !post.isDeleted && user.userID !== post.authorID;
	const viewedPostID = post.postID;

	useEffect(() => {
		const node = articleRef.current;

		if (!shouldCountView || !node || typeof IntersectionObserver === 'undefined') {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					observer.disconnect();
					api.posts.view(viewedPostID).catch(() => undefined);
				}
			},
			{ threshold: 0.6 },
		);
		observer.observe(node);

		return () => observer.disconnect();
	}, [shouldCountView, viewedPostID]);

	const toggleLike = async () => {
		if (!user || isLiking) {
			return;
		}

		const wasLiked = post.likedByMe;
		const step = wasLiked ? -1 : 1;
		setIsLiking(true);
		setPost((current) => ({
			...current,
			likedByMe: !wasLiked,
			likeCount: Math.max(0, current.likeCount + step),
		}));

		try {
			const response = await (wasLiked
				? api.posts.unlike(post.postID)
				: api.posts.like(post.postID));

			if (typeof response.likeCount === 'number') {
				const likeCount = response.likeCount;
				setPost((current) => ({ ...current, likeCount }));
			}
		} catch {
			setPost((current) => ({
				...current,
				likedByMe: wasLiked,
				likeCount: Math.max(0, current.likeCount - step),
			}));
			show({ kind: 'error', message: t('toast.likeFailed') });
		} finally {
			setIsLiking(false);
		}
	};

	return { articleRef, isLiking, toggleLike };
}
