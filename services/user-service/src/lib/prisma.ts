import 'dotenv/config';
import process from 'node:process';
import { PrismaClient } from '../../prisma/generated/prisma/client';
import { createDatabaseClient, redisUrlFromEnv } from '@the-scroll/backend-core';

export const prisma = createDatabaseClient(
	PrismaClient,
	process.env.POSTGRES_USER_SERVICE_DATABASE_URL,
	{
		namespace: 'users',
		redisUrl: redisUrlFromEnv(),
		// Single-use email tokens and send counters, and the notification list and its unread
		// count, must always be read from Postgres.
		excludeModels: ['PendingRegistration', 'Notification'],
	},
);
