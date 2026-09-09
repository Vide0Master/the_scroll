import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';
import { expand } from 'dotenv-expand';
import path from 'node:path';
import process from 'node:process';

export interface PrismaConfigOptions {
	envVarName: string;
	schemaPath?: string;
	migrationsPath?: string;
}

export function createPrismaConfig(options: PrismaConfigOptions) {
	const dbUrl = process.env[options.envVarName];

	if (!dbUrl || dbUrl.includes('${')) {
		const envConfig = dotenv.config({
			path: path.resolve(process.cwd(), '../../.env'),
			override: true,
		});

		expand(envConfig);
	}

	return defineConfig({
		schema: options.schemaPath || 'prisma/schema.prisma',
		migrations: {
			path: options.migrationsPath || 'prisma/migrations',
		},
		datasource: {
			url: process.env[options.envVarName],
		},
	});
}
