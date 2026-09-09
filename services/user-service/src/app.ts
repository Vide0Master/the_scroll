import Fastify from 'fastify';
import cookiePlugin from './plugins/cookie';
import corsPlugin from './plugins/cors';
import authPlugin from './plugins/auth';
import { authRoutes } from './modules/auth/auth.routes';
import { usersRoutes } from './modules/users/users.routes';

export async function buildApp() {
	const fastify = Fastify({
		logger: true,
	});

	await fastify.register(corsPlugin);
	await fastify.register(cookiePlugin);
	await fastify.register(authPlugin);

	await fastify.register(authRoutes, { prefix: '/auth' });
	await fastify.register(usersRoutes, { prefix: '/users' });

	return fastify;
}
