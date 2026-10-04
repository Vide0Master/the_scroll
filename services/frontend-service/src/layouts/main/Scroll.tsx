import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreatePostForm } from '../../components/CreatePostForm';
import { PageHeader } from '../../components/layout/PageHeader';
import { PostList } from '../../components/PostList';
import { Tabs } from '../../elements/Tabs';
import { useCurrentUser } from '../../providers/AuthContext';
import { postCreated } from '../../scripts/events';
import { api } from '../../scripts/api';
import { usePostList } from '../../scripts/useInfiniteList';
import { useNewPosts } from '../../scripts/useNewPosts';

const FEED_PAGE = 30;

export default function Scroll() {
	const { t } = useTranslation();
	const { user } = useCurrentUser();
	const [feedTab, setFeedTab] = useState<'forYou' | 'following'>('forYou');
	const scope = feedTab === 'following' ? 'following' : 'all';
	const list = usePostList(`feed:${feedTab}`, (cursor) =>
		api.posts.getFeed(FEED_PAGE, cursor, scope),
	);
	const fresh = useNewPosts(
		list.items,
		async () => (await api.posts.getFeed(FEED_PAGE, undefined, scope)).posts,
	);

	const showNew = () => {
		list.reload();
		window.scrollTo({ top: 0 });
	};

	return (
		<>
			<PageHeader>
				<Tabs
					activeId={feedTab}
					onChange={(id) => setFeedTab(id as 'forYou' | 'following')}
					tabs={[
						{ id: 'forYou', label: t('feed.forYou') },
						// Needs an account: there is nobody to follow for anyone else.
						{ id: 'following', label: t('feed.following'), disabled: !user },
					]}
				/>
			</PageHeader>

			{user ? (
				<CreatePostForm onPostCreated={(post) => post && postCreated.emit(post)} />
			) : (
				<div className='p-4 border-b border-line text-sm text-muted'>
					{t('feed.loginToPost')}
				</div>
			)}

			{fresh.count > 0 && (
				<button
					type='button'
					onClick={showNew}
					className='w-full px-4 py-3 border-b border-line bg-panel font-mono text-xs uppercase tracking-wide text-accent hover:bg-hover'
				>
					{t('feed.showNew', { n: fresh.isMore ? `${fresh.count}+` : fresh.count })}
				</button>
			)}

			<PostList
				list={list}
				emptyText={t(feedTab === 'following' ? 'feed.emptyFollowing' : 'feed.empty')}
				errorText={t('feed.loadError')}
			/>
		</>
	);
}
