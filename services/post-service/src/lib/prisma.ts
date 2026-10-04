import 'dotenv/config';
import process from 'node:process';
import { PrismaClient } from '../../prisma/generated/prisma/client';
import { createDatabaseClient, redisUrlFromEnv } from '@the-scroll/backend-core';

export const prisma = createDatabaseClient(
	PrismaClient,
	process.env.POSTGRES_POSTS_SERVICE_DATABASE_URL,
	{ namespace: 'posts', redisUrl: redisUrlFromEnv() },
);
