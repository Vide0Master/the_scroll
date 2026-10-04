import { PrismaPg } from '@prisma/adapter-pg';
import { createQueryCacheExtension, type QueryCacheOptions } from './cache/queryCache';
import { createRedisCacheStore } from './cache/redisStore';

export interface DatabaseClientConstructor<T> {
	new (options: { adapter: PrismaPg }): T;
}

export interface DatabaseCacheOptions extends QueryCacheOptions {
	/** Without a URL the plain Prisma client is returned and nothing is cached. */
	redisUrl?: string;
}

/**
 * Creates the service's Prisma client. With `cache.redisUrl` set, reads go through the Redis
 * query cache (see `createQueryCacheExtension`); the returned client has the same API.
 */
export function createDatabaseClient<T>(
	ClientConstructor: DatabaseClientConstructor<T>,
	connectionString?: string,
	cache?: DatabaseCacheOptions,
): T {
	if (!connectionString) {
		throw new Error('Database connection URL is not defined');
	}

	const adapter = new PrismaPg({ connectionString });
	const client = new ClientConstructor({ adapter });

	if (!cache?.redisUrl) {
		return client;
	}

	const extension = createQueryCacheExtension(
		client,
		createRedisCacheStore(cache.redisUrl),
		cache,
	);

	// A query-only extension keeps the client's type, so the cast is safe.
	return (client as unknown as { $extends(extension: unknown): T }).$extends(extension);
}

/**
 * Escapes `%`, `_` and `\` for Prisma's `contains` / `startsWith` filters, which pass the text
 * to SQL LIKE unescaped: without it a search for "%" would match everything and "_" any letter.
 */
export function escapeLike(text: string): string {
	return text.replace(/[\\%_]/g, '\\$&');
}
