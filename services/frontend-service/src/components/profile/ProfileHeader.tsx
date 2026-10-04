import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FollowStats, UserProfile } from '@the-scroll/types';
import { Avatar } from '../../elements/Avatar';
import { Button } from '../../elements/Button';
import { ProfileBanner } from './ProfileBanner';
import { RoleBadges } from './RoleBadges';

export interface ProfileHeaderProps {
	profile: Pick<
		UserProfile,
		| 'userName'
		| 'visibleName'
		| 'avatarUrl'
		| 'bannerUrl'
		| 'bannerGradient'
		| 'roles'
		| 'isBanned'
	> & { createdAt: string | Date };
	isOwnProfile: boolean;
	/** Follower counts and whether the viewer follows; null while unknown. */
	stats: FollowStats | null;
	/** Follow or unfollow; the profile page owns the request. Omitted for guests. */
	onToggleFollow?: () => void;
}

export function ProfileHeader({
	profile,
	isOwnProfile,
	stats,
	onToggleFollow,
}: ProfileHeaderProps) {
	const {
		userName,
		visibleName,
		avatarUrl,
		bannerUrl,
		bannerGradient,
		roles,
		isBanned,
		createdAt,
	} = profile;
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const locale = i18n.language.startsWith('ua') ? 'uk' : i18n.language;
	const date = new Date(createdAt);
	const joined = Number.isNaN(date.getTime())
		? ''
		: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);

	return (
		<div className='border-b border-line'>
			<ProfileBanner
				bannerUrl={bannerUrl}
				bannerGradient={bannerGradient}
			/>

			<div className='px-4 pb-4'>
				<div className='flex items-start justify-between'>
					{/* A picture sits directly on the banner (no frame) so its transparency shows. */}
					<div
						className={`-mt-14 ${avatarUrl ? '' : 'border-4 border-surface bg-surface'}`}
					>
						<Avatar
							name={visibleName || userName}
							src={avatarUrl}
							size='xl'
						/>
					</div>
					{isOwnProfile ? (
						<Button
							onClick={() => navigate('/settings/profile')}
							className='mt-3'
						>
							{t('profile.editProfile')}
						</Button>
					) : (
						<Button
							onClick={onToggleFollow}
							disabled={!stats}
							className='mt-3'
						>
							{t(stats?.isFollowing ? 'profile.unfollow' : 'profile.follow')}
						</Button>
					)}
				</div>

				<h2 className='mt-2 text-xl font-bold truncate'>{visibleName || userName}</h2>
				<div className='font-mono text-muted truncate'>@{userName}</div>
				<RoleBadges roles={roles ?? []} />
				{isBanned && (
					<div className='mt-2 inline-block px-2 py-0.5 border border-red-500 font-mono text-[11px] font-semibold uppercase tracking-wider text-red-500'>
						{t('profile.blocked')}
					</div>
				)}
				{joined && (
					<div className='mt-2 font-mono text-sm text-muted'>
						{t('profile.joined', { date: joined })}
					</div>
				)}

				{/* Read-only for now: there is no page listing the accounts behind the numbers. */}
				<div className='mt-2 flex gap-4 text-sm'>
					<span>
						<b>{stats?.followingCount ?? 0}</b>{' '}
						<span className='font-mono text-xs uppercase tracking-wide text-muted'>
							{t('profile.following')}
						</span>
					</span>
					<span>
						<b>{stats?.followerCount ?? 0}</b>{' '}
						<span className='font-mono text-xs uppercase tracking-wide text-muted'>
							{t('profile.followers')}
						</span>
					</span>
				</div>
			</div>
		</div>
	);
}
