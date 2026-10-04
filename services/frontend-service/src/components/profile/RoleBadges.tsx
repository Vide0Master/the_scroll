import { useTranslation } from 'react-i18next';
import type { UserRole } from '@the-scroll/types';

// Admin stands out in the accent color, the other roles stay in the neutral frame.
const badgeClass = (role: UserRole) =>
	role === 'ADMIN' ? 'border-accent text-accent' : 'border-line text-main';

export interface RoleBadgesProps {
	roles: UserRole[];
}

/** One small framed tag per role; renders nothing for a regular user. */
export function RoleBadges({ roles }: RoleBadgesProps) {
	const { t } = useTranslation();

	if (roles.length === 0) {
		return null;
	}

	return (
		<ul className='mt-2 flex flex-wrap gap-2'>
			{roles.map((role) => (
				<li
					key={role}
					className={`px-2 py-0.5 border font-mono text-[11px] font-semibold uppercase tracking-wider ${badgeClass(role)}`}
				>
					{t(`roles.${role.toLowerCase()}`)}
				</li>
			))}
		</ul>
	);
}
