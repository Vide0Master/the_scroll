import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { profilePath } from '../../scripts/routes';
import { useTrending } from '../../scripts/useTrending';
import { UserCard } from '../UserCard';

/** Accounts whose posts got the most likes and replies in the last days. Hidden while empty. */
export function WhoToFollowCard() {
	const { t } = useTranslation();
	const { users } = useTrending();

	if (users.length === 0) {
		return null;
	}

	return (
		<section className='border border-line bg-surface overflow-hidden'>
			<h2 className='px-4 py-3 border-b border-line font-mono text-xs uppercase tracking-widest text-muted'>
				{t('widgets.followTitle')}
			</h2>
			<ul className='divide-y divide-line'>
				{users.map(({ user, score }) => (
					<li key={user.userID}>
						<Link
							to={profilePath(user.userName)}
							className='flex items-center justify-between gap-2 px-4 py-3 hover:bg-hover'
						>
							<UserCard
								userName={user.userName}
								visibleName={user.visibleName}
								avatarUrl={user.avatarUrl}
								className='min-w-0'
							/>
							<span className='shrink-0 font-mono text-xs text-muted'>
								{t('widgets.reactions', { count: score })}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
