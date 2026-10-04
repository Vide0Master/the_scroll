import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { router } from './App.tsx';
import { RouterProvider } from 'react-router-dom';
import { ToastProvider } from './providers/ToastProvider.tsx';
import { AuthProvider } from './providers/AuthProvider.tsx';
import { NotificationsProvider } from './providers/NotificationsProvider.tsx';
import { ThemeProvider } from './providers/ThemeProvider.tsx';

import './scripts/i18n.ts';
import './scripts/feedSync.ts';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<AuthProvider>
			<ThemeProvider>
				<ToastProvider navigate={(to) => void router.navigate(to)}>
					<NotificationsProvider>
						<RouterProvider router={router} />
					</NotificationsProvider>
				</ToastProvider>
			</ThemeProvider>
		</AuthProvider>
	</StrictMode>,
);
