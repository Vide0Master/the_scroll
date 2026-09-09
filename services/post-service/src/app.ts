import Fastify from 'fastify';
import cookiePlugin from './plugins/cookie';
import corsPlugin from './plugins/cors';
import authPlugin from './plugins/auth';
import { postsRoutes } from './modules/posts/posts.routes';

export async function buildApp() {
	const fastify = Fastify({ logger: true });

	await fastify.register(corsPlugin);
	await fastify.register(cookiePlugin);
	await fastify.register(authPlugin);

	await fastify.register(postsRoutes, { prefix: '/posts' });

	return fastify;
}
