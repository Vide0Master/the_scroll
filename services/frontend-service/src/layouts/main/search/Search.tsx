import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SearchTag, UserProfile } from '@the-scroll/types';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PostList } from '../../../components/PostList';
import { SearchBox } from '../../../components/SearchBox';
import { Avatar } from '../../../elements/Avatar';
import { Tabs } from '../../../elements/Tabs';
import { api, getApiError } from '../../../scripts/api';
import { usePostList } from '../../../scripts/useInfiniteList';
import { hashtagPath, profilePath } from '../../../scripts/routes';

type SearchTab = 'posts' | 'people' | 'tags';

type Results =
	| { status: 'invalid' }
	| { status: 'error' }
	| { status: 'people'; users: UserProfile[] }
	| { status: 'tags'; tags: SearchTag[] };

async function search(query: string, tab: Exclude<SearchTab, 'posts'>): Promise<Results> {
	try {
		if (tab === 'people') {
			const users = await api.users.search(query, { match: 'contains', limit: 30 });
			return { status: 'people', users: users.users };
		}

		const tags = await api.posts.tags(query, 'contains', 30);
		return { status: 'tags', tags: tags.tags };
	} catch (error) {
		return { status: getApiError(error).code === 'invalidQuery' ? 'invalid' : 'error' };
	}
}

/** Search results for `?q=`: posts by keyword (or #hashtag), people, and hashtags. */
export default function Search() {
	const { t } = useTranslation();
	const [params, setParams] = useSearchParams();
	const query = (params.get('q') ?? '').trim();
	const tab: SearchTab = ['people', 'tags'].includes(params.get('tab') ?? '')
		? (params.get('tab') as SearchTab)
		: 'posts';
	const [result, setResult] = useState<{ key: string; results: Results } | null>(null);
	const key = `${tab}:${query}`;

	// The posts tab pages its results; on the other tabs the list is an inert placeholder key.
	const found = usePostList(`search:${tab === 'posts' ? query : ''}`, async (cursor) =>
		!query || tab !== 'posts' ? { posts: [] } : api.posts.search(query, cursor),
	);
	// A query the server refuses (nothing searchable in it) is told apart from a failed request.
	const isRefused = found.hasFailed && getApiError(found.error).code === 'invalidQuery';

	useEffect(() => {
		if (!query || tab === 'posts') {
			return;
		}

		let isActive = true;

		search(query, tab).then((results) => {
			if (isActive) {
				setResult({ key, results });
			}
		});

		return () => {
			isActive = false;
		};
	}, [query, tab, key]);

	// A result loaded for a previous query or tab counts as "still loading".
	const results = query && tab !== 'posts' && result?.key === key ? result.results : null;
	const isPosts = !!query && tab === 'posts';

	const changeTab = (id: string) => {
		const next = new URLSearchParams(params);

		if (id === 'posts') {
			next.delete('tab');
		} else {
			next.set('tab', id);
		}

		setParams(next);
	};

	const isEmpty =
		results &&
		((results.status === 'people' && results.users.length === 0) ||
			(results.status === 'tags' && results.tags.length === 0));

	return (
		<>
			<PageHeader title={t('search.title')}>
				<div className='px-4 pb-3'>
					{/* Remounted per query so the box shows what the page is showing. */}
					<SearchBox
						key={query}
						initialValue={query}
					/>
				</div>
				<Tabs
					activeId={tab}
					onChange={changeTab}
					tabs={[
						{ id: 'posts', label: t('search.tabs.posts') },
						{ id: 'people', label: t('search.tabs.people') },
						{ id: 'tags', label: t('search.tabs.tags') },
					]}
				/>
			</PageHeader>

			{!query && <div className='p-8 text-center text-muted'>{t('search.prompt')}</div>}

			{query && !isPosts && results === null && (
				<div className='h-24 bg-hover animate-pulse' />
			)}

			{(results?.status === 'invalid' || (isPosts && isRefused)) && (
				<div className='p-8 text-center text-muted'>{t('search.invalid')}</div>
			)}

			{results?.status === 'error' && (
				<div className='p-8 text-center text-red-500'>{t('search.loadError')}</div>
			)}

			{isEmpty && (
				<div className='p-8 text-center text-sm text-muted'>
					{t(`search.empty.${tab}`, { query })}
				</div>
			)}

			{isPosts && !isRefused && (
				<PostList
					list={found}
					emptyText={t('search.empty.posts', { query })}
					errorText={t('search.loadError')}
				/>
			)}

			{results?.status === 'people' &&
				results.users.map((user) => (
					<Link
						key={user.userID}
						to={profilePath(user.userName)}
						className='flex items-center gap-3 px-4 py-3 border-b border-line hover:bg-hover transition-colors'
					>
						<Avatar
							name={user.visibleName || user.userName}
							src={user.avatarUrl}
						/>
						<span className='flex flex-col min-w-0 leading-tight font-mono text-xs'>
							<span className='font-semibold uppercase tracking-wide truncate'>
								{user.visibleName || user.userName}
							</span>
							<span className='text-muted truncate'>@{user.userName}</span>
						</span>
					</Link>
				))}

			{results?.status === 'tags' &&
				results.tags.map(({ tag, count }) => (
					<Link
						key={tag}
						to={hashtagPath(tag)}
						className='flex items-baseline justify-between gap-3 px-4 py-3 border-b border-line hover:bg-hover transition-colors font-mono'
					>
						<span className='text-accent truncate'>#{tag}</span>
						<span className='text-xs text-muted shrink-0'>
							{t('search.postsCount', { count })}
						</span>
					</Link>
				))}
		</>
	);
}
