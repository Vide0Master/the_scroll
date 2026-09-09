import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from './layouts/auth/AuthLayout';
import Register from './layouts/auth/Register';
import Login from './layouts/auth/Login';
import MainLayout from './layouts/main/MainLayout';
import NotFound from './layouts/NotFound';
import Scroll from './layouts/main/Scroll';
import Settings from './layouts/main/settings/Settings';

export const router = createBrowserRouter([
	{
		path: '/',
		element: <MainLayout />,
		children: [
			{ index: true, element: <Scroll /> },
			{ path: '/settings', element: <Settings /> },
		],
	},
	{
		path: '/auth',
		element: <AuthLayout />,
		children: [
			{
				index: true,
				element: (
					<Navigate
						to='login'
						replace
					/>
				),
			},
			{ path: 'register', element: <Register /> },
			{ path: 'login', element: <Login /> },
		],
	},
	{
		path: '*',
		element: <NotFound />,
	},
]);
