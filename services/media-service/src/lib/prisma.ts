import 'dotenv/config';
import process from 'node:process';
import { PrismaClient } from '../../prisma/generated/prisma/client';
import { createDatabaseClient } from '@the-scroll/backend-core';

// No query cache here: usage lookups decide what gets deleted, so they must always be fresh.
export const prisma = createDatabaseClient(
	PrismaClient,
	process.env.POSTGRES_MEDIA_SERVICE_DATABASE_URL,
);
