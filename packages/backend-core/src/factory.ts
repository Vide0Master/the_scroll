import Fastify, { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import { createAuthPlugin } from './plugins/auth';
import { BaseSessionUser } from './types/fastify';

export interface ServiceRouteGroup {
	prefix: string;
	plugin: FastifyPluginAsync;
}

export interface MicroserviceConfig {
	name: string;
	port: number;
	cookieSecret: string;
	validateSession?: (sessionID: string) => Promise<BaseSessionUser | null>;
	routes?: ServiceRouteGroup[];
	setup?: (app: FastifyInstance) => Promise<void> | void;
}

export async function createMicroservice(options: MicroserviceConfig) {
	const app = Fastify({
		logger: true,
	});

	await app.register(fastifyCors, {
		origin: true,
		credentials: true,
	});

	await app.register(fastifyCookie, {
		secret: options.cookieSecret,
	});

	if (options.validateSession) {
		const authPlugin = createAuthPlugin({
			validateSession: options.validateSession,
		});
		await app.register(authPlugin);
	}

	app.get('/health', async () => {
		return { status: 'ok', service: options.name, uptime: process.uptime() };
	});

	if (options.setup) {
		await options.setup(app);
	}

	if (options.routes) {
		for (const route of options.routes) {
			await app.register(route.plugin, { prefix: route.prefix });
		}
	}

	return {
		app,
		start: async () => {
			try {
				await app.listen({ port: options.port, host: '0.0.0.0' });
				console.log(`[${options.name}] running on port ${options.port}`);
			} catch (err) {
				app.log.error(err);
				process.exit(1);
			}
		},
	};
}
