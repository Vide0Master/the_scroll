import { Outlet } from 'react-router-dom';
import { RightMenu } from './RightMenu';

export default function MainLayout() {
	return (
		<div className='w-screen h-screen bg-surface flex flex-row justify-center text-main overflow-hidden'>
			<aside className='w-64 h-full flex flex-col p-4 border-r border-border/20'>
				<div>Левое меню</div>
			</aside>

			<main className='flex-1 max-w-2xl h-full overflow-y-auto p-4'>
				<Outlet />
			</main>

			<RightMenu />
		</div>
	);
}
