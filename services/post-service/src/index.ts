import 'dotenv/config';
import process from 'node:process';
import { createMicroservice } from '@the-scroll/backend-core';
import { validateUserSessionViaService } from './lib/authValidator';
import { postsRoutes } from './modules/posts/posts.routes';

const port = Number(process.env.PORT_POSTS_SERVICE) || 3002;
const cookieSecret = process.env.USER_SERVICE_COOKIE_SECRET;

const usersPort = process.env.PORT_USERS_SERVICE || process.env.PORT_USER_SERVICE || 3001;
const userServiceUrl = process.env.INTERNAL_USER_SERVICE_URL || `http://127.0.0.1:${usersPort}`;

if (!cookieSecret) {
	throw new Error('USER_SERVICE_COOKIE_SECRET is undefined');
}

const service = await createMicroservice({
	name: 'posts-service',
	port,
	cookieSecret,
	validateSession: async (sessionID) => {
		return validateUserSessionViaService(sessionID, userServiceUrl);
	},
	routes: [
		{
			prefix: '/posts',
			plugin: async (instance) => {
				await instance.register(postsRoutes, { userServiceUrl });
			},
		},
	],
});

await service.start();
