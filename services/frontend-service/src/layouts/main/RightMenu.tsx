import { NavLink } from 'react-router-dom';
import { UserCard } from '../../components/UserCard';
import { Cog6ToothIcon, HomeIcon } from '@heroicons/react/16/solid';

export function RightMenu() {
	return (
		<aside className='w-72 h-full flex flex-col justify-between p-4 border-l border-border/20 select-none'>
			<nav className='flex flex-col gap-2'>
				<NavLink
					to={'/'}
					className={({ isActive }) =>
						`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
							isActive
								? 'bg-primary text-white shadow-sm'
								: 'text-main hover:bg-surface-secondary/60 opacity-80 hover:opacity-100'
						}`
					}
				>
					<HomeIcon height={20} />
					<span>Главная</span>
				</NavLink>
				<NavLink
					to='/settings'
					className={({ isActive }) =>
						`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
							isActive
								? 'bg-primary text-white shadow-sm'
								: 'text-main hover:bg-surface-secondary/60 opacity-80 hover:opacity-100'
						}`
					}
				>
					<Cog6ToothIcon height={20} />
					<span>Настройки</span>
				</NavLink>
			</nav>

			<div className='pt-4 border-t border-border/10'>
				<UserCard />
			</div>
		</aside>
	);
}
