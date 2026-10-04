import 'dotenv/config';
import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { createMicroservice } from '@the-scroll/backend-core';
import { MEDIA_MAX_FILE_SIZE_BYTES } from '@the-scroll/types';
import { validateUserSessionViaService } from './lib/authValidator';
import { mediaRoutes } from './modules/media/media.routes';
import { internalRoutes } from './modules/internal/internal.routes';
import { startOrphanSweeper } from './lib/orphanSweeper';

const port = Number(process.env.PORT_MEDIA_SERVICE);
const cookieSecret = process.env.USER_SERVICE_COOKIE_SECRET;

const usersPort = process.env.PORT_USERS_SERVICE || process.env.PORT_USER_SERVICE || 3001;
const userServiceUrl = process.env.INTERNAL_USER_SERVICE_URL || `http://127.0.0.1:${usersPort}`;

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
	validateSession: async (sessionID) => {
		return validateUserSessionViaService(sessionID, userServiceUrl);
	},
	setup: async (app) => {
		await app.register(fastifyMultipart, {
			limits: {
				fileSize: MEDIA_MAX_FILE_SIZE_BYTES,
				files: 12,
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
		{
			prefix: '/internal',
			plugin: async (instance) => {
				await instance.register(internalRoutes, { uploadDir });
			},
		},
	],
});

await service.start();
startOrphanSweeper(service.app.log, uploadDir);
