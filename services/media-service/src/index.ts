import 'dotenv/config';
import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { createMicroservice } from '@the-scroll/backend-core';
import { mediaRoutes } from './modules/media/media.routes';

const port = Number(process.env.PORT_MEDIA_SERVICE);
const cookieSecret = process.env.USER_SERVICE_COOKIE_SECRET;

if (!port || Number.isNaN(port)) {
	throw new Error('PORT_MEDIA_SERVICE is undefined or invalid');
}

if (!cookieSecret) {
	throw new Error('USER_SERVICE_COOKIE_SECRET is undefined');
}

const uploadDir = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true });
}

const service = await createMicroservice({
	name: 'media-service',
	port,
	cookieSecret,
	setup: async (app) => {
		await app.register(fastifyMultipart, {
			limits: {
				fileSize: 20 * 1024 * 1024,
				files: 5,
			},
		});

		await app.register(fastifyStatic, {
			root: uploadDir,
			prefix: '/media/file/',
		});
	},
	routes: [
		{
			prefix: '/media',
			plugin: async (instance) => {
				await instance.register(mediaRoutes, { uploadDir });
			},
		},
	],
});

await service.start();
