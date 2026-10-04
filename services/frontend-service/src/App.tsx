import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from './layouts/auth/AuthLayout';
import Register from './layouts/auth/Register';
import Login from './layouts/auth/Login';
import Verify from './layouts/auth/Verify';
import MainLayout from './layouts/main/MainLayout';
import NotFound from './layouts/NotFound';
import Scroll from './layouts/main/Scroll';
import Settings from './layouts/main/settings/Settings';
import SettingsMenu from './layouts/main/settings/SettingsMenu';
import ProfileSettings from './layouts/main/settings/ProfileSettings';
import ThemeSettings from './layouts/main/settings/ThemeSettings';
import Profile from './layouts/main/profile/Profile';
import PostDetail from './layouts/main/post/PostDetail';
import Hashtag from './layouts/main/hashtag/Hashtag';
import Admin from './layouts/main/admin/Admin';
import AdminMenu from './layouts/main/admin/AdminMenu';
import {
	AdminBanned,
	AdminMetricsPage,
	AdminPostsPage,
	AdminUsersPage,
} from './layouts/main/admin/AdminSections';
import Notifications from './layouts/main/notifications/Notifications';
import NotificationSettings from './layouts/main/settings/NotificationSettings';
import Search from './layouts/main/search/Search';

export const router = createBrowserRouter([
	{
		path: '/',
		element: <MainLayout />,
		children: [
			{ index: true, element: <Scroll /> },
			{
				path: '/settings',
				element: <Settings />,
				children: [
					{ index: true, element: <SettingsMenu /> },
					{ path: 'profile', element: <ProfileSettings /> },
					{ path: 'theme', element: <ThemeSettings /> },
					{ path: 'notifications', element: <NotificationSettings /> },
				],
			},
			{ path: '/u/:userName', element: <Profile /> },
			{ path: '/post/:postID', element: <PostDetail /> },
			{ path: '/hashtag/:tag', element: <Hashtag /> },
			{
				path: '/admin',
				element: <Admin />,
				children: [
					{ index: true, element: <AdminMenu /> },
					{ path: 'users', element: <AdminUsersPage /> },
					{ path: 'banned', element: <AdminBanned /> },
					{ path: 'posts', element: <AdminPostsPage /> },
					{ path: 'metrics', element: <AdminMetricsPage /> },
				],
			},
			{ path: '/notifications', element: <Notifications /> },
			{ path: '/search', element: <Search /> },
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
			{ path: 'verify', element: <Verify /> },
		],
	},
	{
		path: '*',
		element: <NotFound />,
	},
]);
