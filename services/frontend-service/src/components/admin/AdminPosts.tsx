import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FeedPost } from '@the-scroll/types';
import { api } from '../../scripts/api';
import { PostCard } from '../PostCard';

/** The latest posts, removed ones included; each card carries its own [remove] for moderators. */
export function AdminPosts() {
	const { t } = useTranslation();
	const [posts, setPosts] = useState<FeedPost[] | null>(null);
	const [hasError, setHasError] = useState(false);

	useEffect(() => {
		let isActive = true;

		api.posts
			.moderationList()
			.then((response) => isActive && setPosts(response.posts))
			.catch(() => isActive && setHasError(true));

		return () => {
			isActive = false;
		};
	}, []);

	if (hasError) {
		return <div className='p-4 text-sm text-red-500'>{t('admin.loadError')}</div>;
	}

	if (posts?.length === 0) {
		return <div className='p-8 text-center text-sm text-muted'>{t('admin.emptyPosts')}</div>;
	}

	return (
		<>
			{posts?.map((post) => (
				<PostCard
					key={post.postID}
					post={post}
				/>
			))}
		</>
	);
}
