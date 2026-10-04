import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PostMetrics, UserMetrics } from '@the-scroll/types';
import { api } from '../../scripts/api';
import { hashtagPath, postPath } from '../../scripts/routes';

interface Loaded {
	users: UserMetrics;
	posts: PostMetrics;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className='border-b border-line'>
			<h2 className='px-4 py-3 border-b border-line font-mono text-xs uppercase tracking-widest text-muted'>
				{title}
			</h2>
			{children}
		</section>
	);
}

function Figures({ items }: { items: [string, number][] }) {
	return (
		<dl className='grid grid-cols-2 divide-x divide-y divide-line'>
			{items.map(([label, value]) => (
				<div
					key={label}
					className='px-4 py-3'
				>
					<dt className='font-mono text-xs text-muted'>{label}</dt>
					<dd className='font-mono text-xl'>{value}</dd>
				</div>
			))}
		</dl>
	);
}

/** Account, content and engagement counters plus what is trending, for moderators and admins. */
export function AdminMetrics() {
	const { t } = useTranslation();
	const [data, setData] = useState<Loaded | null>(null);
	const [hasFailed, setHasFailed] = useState(false);

	useEffect(() => {
		let isActive = true;

		Promise.all([api.admin.metrics(), api.posts.metrics()])
			.then(([users, posts]) => {
				if (isActive) {
					setData({ users: users.metrics, posts: posts.metrics });
				}
			})
			.catch(() => {
				if (isActive) {
					setHasFailed(true);
				}
			});

		return () => {
			isActive = false;
		};
	}, []);

	if (hasFailed) {
		return <p className='px-4 py-6 text-sm text-muted'>{t('admin.metrics.loadError')}</p>;
	}

	if (!data) {
		return null;
	}

	const { users, posts } = data;
	const m = (key: string) => t(`admin.metrics.${key}`);

	return (
		<>
			<Group title={m('accounts')}>
				<Figures
					items={[
						[m('accountsTotal'), users.users],
						[m('accountsBlocked'), users.banned],
						[m('accountsToday'), users.usersToday],
						[m('follows'), users.follows],
					]}
				/>
			</Group>
			<Group title={m('content')}>
				<Figures
					items={[
						[m('posts'), posts.posts],
						[m('replies'), posts.replies],
						[m('deleted'), posts.deleted],
						[m('postsToday'), posts.postsToday],
					]}
				/>
			</Group>
			<Group title={m('engagement')}>
				<Figures
					items={[
						[m('likes'), posts.likes],
						[m('views'), posts.views],
						[m('likesToday'), posts.likesToday],
						[m('viewsToday'), posts.viewsToday],
					]}
				/>
			</Group>
			<Group title={m('topTags')}>
				{posts.topTags.length === 0 ? (
					<p className='px-4 py-3 text-sm text-muted'>{m('noData')}</p>
				) : (
					<ul className='divide-y divide-line'>
						{posts.topTags.map(({ tag, score }) => (
							<li key={tag}>
								<Link
									to={hashtagPath(tag)}
									className='flex justify-between px-4 py-3 font-mono text-sm hover:bg-hover'
								>
									<span>#{tag}</span>
									<span className='text-muted'>{score}</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</Group>
			<Group title={m('topPosts')}>
				{posts.topPosts.length === 0 ? (
					<p className='px-4 py-3 text-sm text-muted'>{m('noData')}</p>
				) : (
					<ul className='divide-y divide-line'>
						{posts.topPosts.map(({ postID, views, likes }) => (
							<li key={postID}>
								<Link
									to={postPath(postID)}
									className='flex justify-between gap-3 px-4 py-3 font-mono text-sm hover:bg-hover'
								>
									<span className='truncate'>{postID.slice(0, 8)}</span>
									<span className='shrink-0 text-muted'>
										{t('admin.metrics.viewsLikes', { views, likes })}
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</Group>
		</>
	);
}
