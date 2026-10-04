import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FollowStats, Types } from '@the-scroll/types';
import { InfiniteSentinel } from '../../../components/InfiniteSentinel';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PostList } from '../../../components/PostList';
import { ProfileHeader } from '../../../components/profile/ProfileHeader';
import { ProfileMediaGrid } from '../../../components/profile/ProfileMediaGrid';
import { Tabs } from '../../../elements/Tabs';
import { useCurrentUser } from '../../../providers/AuthContext';
import { useToast } from '../../../providers/ToastContext';
import { api, getApiError, isProfileNotFound } from '../../../scripts/api';
import { usePostList } from '../../../scripts/useInfiniteList';

type ProfileTab = 'posts' | 'replies' | 'media';

type ProfileUser = NonNullable<Types['api']['auth']['user']['res']['userData']>;

type ProfileState =
	| { status: 'notFound' }
	| { status: 'error' }
	| {
			status: 'ready';
			profile: ProfileUser;
			stats: FollowStats | null;
	  };

async function loadProfile(userName: string): Promise<ProfileState> {
	try {
		const data = await api.users.getByUsername(userName);

		if (!data.userData) {
			return { status: 'notFound' };
		}

		const profile = data.userData;
		// The counters are a nicety: a failure here must not hide the profile.
		const statsResponse = await api.follows.stats(userName).catch(() => null);

		return {
			status: 'ready',
			profile,
			stats: statsResponse?.stats ?? null,
		};
	} catch (error) {
		return { status: isProfileNotFound(getApiError(error)) ? 'notFound' : 'error' };
	}
}

interface ProfilePostsProps {
	profile: ProfileUser;
	kind: 'posts' | 'replies';
	asMedia: boolean;
}

/** An author's posts or replies, loaded a page at a time as the end scrolls into view. */
function ProfilePosts({ profile, kind, asMedia }: ProfilePostsProps) {
	const { t } = useTranslation();
	const list = usePostList(`profile:${profile.userID}:${kind}`, (cursor) =>
		api.posts.getByAuthor(profile.userID, kind, cursor),
	);
	const author = {
		userID: profile.userID,
		userName: profile.userName,
		visibleName: profile.visibleName,
		avatarUrl: profile.avatarUrl,
	};

	if (asMedia) {
		return (
			<>
				{list.isLoading ? (
					<div className='h-32 bg-hover animate-pulse' />
				) : (
					<ProfileMediaGrid posts={list.items} />
				)}
				<InfiniteSentinel
					hasMore={list.hasMore}
					isLoading={list.isLoadingMore}
					hasFailed={list.hasFailed && list.items.length > 0}
					onLoadMore={list.loadMore}
					itemCount={list.items.length}
				/>
			</>
		);
	}

	return (
		<PostList
			list={list}
			decorate={(post) => ({ ...post, author })}
			emptyText={t(kind === 'posts' ? 'profile.noPosts' : 'profile.noReplies')}
			errorText={t('profile.loadError')}
		/>
	);
}

export default function Profile() {
	const { t } = useTranslation();
	const { userName = '' } = useParams<{ userName: string }>();
	const { user: currentUser } = useCurrentUser();
	const { show } = useToast();
	const [result, setResult] = useState<{ forUserName: string; state: ProfileState } | null>(null);
	const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
	const navigate = useNavigate();
	// Set after a follow/unfollow so the numbers change at once; belongs to one profile.
	const [statsOverride, setStatsOverride] = useState<{
		forUserName: string;
		stats: FollowStats;
	} | null>(null);

	useEffect(() => {
		let isActive = true;

		loadProfile(userName).then((state) => {
			if (isActive) {
				setResult({ forUserName: userName, state });
			}
		});

		return () => {
			isActive = false;
		};
	}, [userName]);

	// A result loaded for a previously viewed profile counts as "still loading".
	const view = result?.forUserName === userName ? result.state : null;

	const toggleFollow = async (loadedStats: FollowStats | null) => {
		if (!currentUser) {
			navigate('/auth/login');
			return;
		}

		const current = statsOverride?.forUserName === userName ? statsOverride.stats : loadedStats;

		if (!current) {
			return;
		}

		// Shown at once, then confirmed by the server; a failure puts the old numbers back.
		const next: FollowStats = current.isFollowing
			? { ...current, isFollowing: false, followerCount: current.followerCount - 1 }
			: { ...current, isFollowing: true, followerCount: current.followerCount + 1 };
		setStatsOverride({ forUserName: userName, stats: next });

		try {
			await (current.isFollowing
				? api.follows.unfollow(userName)
				: api.follows.follow(userName));
		} catch {
			setStatsOverride({ forUserName: userName, stats: current });
			show({ kind: 'error', message: t('toast.followFailed') });
		}
	};

	const title =
		view?.status === 'ready'
			? view.profile.visibleName || view.profile.userName
			: t('nav.profile');

	return (
		<>
			<PageHeader title={title} />

			{view === null && <div className='h-48 bg-hover animate-pulse' />}

			{view?.status === 'notFound' && (
				<div className='p-8 text-center text-muted'>{t('profile.notFound')}</div>
			)}

			{view?.status === 'error' && (
				<div className='p-8 text-center text-red-500'>{t('profile.loadError')}</div>
			)}

			{view?.status === 'ready' && (
				<>
					<ProfileHeader
						profile={view.profile}
						isOwnProfile={currentUser?.userID === view.profile.userID}
						stats={
							statsOverride?.forUserName === userName
								? statsOverride.stats
								: view.stats
						}
						onToggleFollow={() => toggleFollow(view.stats)}
					/>

					{/* Likes have no feature behind them yet. */}
					<Tabs
						activeId={activeTab}
						onChange={(id) => setActiveTab(id as ProfileTab)}
						tabs={[
							{ id: 'posts', label: t('profile.tabs.posts') },
							{ id: 'replies', label: t('profile.tabs.replies') },
							{ id: 'media', label: t('profile.tabs.media') },
							{ id: 'likes', label: t('profile.tabs.likes'), disabled: true },
						]}
					/>

					{/* Each tab pages its own list; the media grid reuses the posts list. */}
					<ProfilePosts
						key={`${view.profile.userID}:${activeTab === 'replies' ? 'replies' : 'posts'}`}
						profile={view.profile}
						kind={activeTab === 'replies' ? 'replies' : 'posts'}
						asMedia={activeTab === 'media'}
					/>
				</>
			)}
		</>
	);
}
