import { useEffect, useState, useCallback } from 'react';
import { api } from '../../scripts/api';
import { CreatePostForm } from '../../components/CreatePostForm';
import { PostCard, type AuthorProfile } from '../../components/PostCard';

interface FeedPostItem {
	postID: string;
	authorID: string;
	author?: AuthorProfile | null;
	content: string;
	media: string[];
	createdAt: string;
}

export default function Scroll() {
	const [posts, setPosts] = useState<FeedPostItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const fetchFeed = useCallback(async () => {
		try {
			const response = await api.posts.getFeed(30);
			if (response && response.posts) {
				setPosts(response.posts as unknown as FeedPostItem[]);
			}
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchFeed();
	}, [fetchFeed]);

	return (
		<div className='flex flex-col gap-4 w-full pb-10'>
			<CreatePostForm onPostCreated={fetchFeed} />

			{isLoading ? (
				<div className='flex flex-col gap-3'>
					<div className='p-4 rounded-xl bg-surface-secondary/30 border border-border/20 animate-pulse h-32 w-full' />
					<div className='p-4 rounded-xl bg-surface-secondary/30 border border-border/20 animate-pulse h-40 w-full' />
				</div>
			) : posts.length === 0 ? (
				<div className='p-8 text-center text-main/50 text-sm border border-dashed border-border/30 rounded-xl'>
					No posts in the feed yet. Start the conversation!
				</div>
			) : (
				<div className='flex flex-col gap-3'>
					{posts.map((post) => (
						<PostCard
							key={post.postID}
							postID={post.postID}
							authorID={post.authorID}
							author={post.author}
							content={post.content}
							media={post.media}
							createdAt={post.createdAt}
						/>
					))}
				</div>
			)}
		</div>
	);
}
