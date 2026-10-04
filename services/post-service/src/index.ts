import 'dotenv/config';
import process from 'node:process';
import { createMediaUsageClient, createMicroservice } from '@the-scroll/backend-core';
import { createNotifier } from './lib/notifier';
import { validateUserSessionViaService } from './lib/authValidator';
import { postsRoutes } from './modules/posts/posts.routes';

const port = Number(process.env.PORT_POSTS_SERVICE) || 3002;
const cookieSecret = process.env.USER_SERVICE_COOKIE_SECRET;

const usersPort = process.env.PORT_USERS_SERVICE || process.env.PORT_USER_SERVICE || 3001;
const userServiceUrl = process.env.INTERNAL_USER_SERVICE_URL || `http://127.0.0.1:${usersPort}`;

const media = createMediaUsageClient({
	url: process.env.INTERNAL_MEDIA_SERVICE_URL,
	token: process.env.INTERNAL_API_TOKEN,
});

const notifier = createNotifier({ url: userServiceUrl, token: process.env.INTERNAL_API_TOKEN });

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
				await instance.register(postsRoutes, { userServiceUrl, media, notifier });
			},
		},
	],
});

await service.start();
