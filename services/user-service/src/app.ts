import Fastify from 'fastify';
import { createMediaUsageClient } from '@the-scroll/backend-core';
import cookiePlugin from './plugins/cookie';
import corsPlugin from './plugins/cors';
import authPlugin from './plugins/auth';
import { authRoutes } from './modules/auth/auth.routes';
import { usersRoutes } from './modules/users/users.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { followsRoutes } from './modules/follows/follows.routes';
import { notificationsRoutes } from './modules/notifications/notifications.routes';
import { internalRoutes } from './modules/notifications/internal.routes';
import { settingsRoutes } from './modules/settings/settings.routes';
import { config } from './config/env';
import { profileRoutes } from './modules/profile/profile.routes';

export async function buildApp() {
	const fastify = Fastify({
		logger: true,
	});

	await fastify.register(corsPlugin);
	await fastify.register(cookiePlugin);
	await fastify.register(authPlugin);

	await fastify.register(authRoutes, { prefix: '/auth' });
	await fastify.register(adminRoutes, { prefix: '/users/admin' });
	await fastify.register(usersRoutes, { prefix: '/users' });
	await fastify.register(followsRoutes, { prefix: '/users' });
	await fastify.register(notificationsRoutes, { prefix: '/notifications' });
	await fastify.register(internalRoutes, { prefix: '/internal' });
	await fastify.register(settingsRoutes, { prefix: '/users' });
	await fastify.register(profileRoutes, {
		prefix: '/users',
		media: createMediaUsageClient({
			url: config.internalMediaServiceUrl,
			token: config.internalApiToken,
		}),
	});

	return fastify;
}
