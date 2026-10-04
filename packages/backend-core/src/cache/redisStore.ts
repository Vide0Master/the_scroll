import { Redis } from 'ioredis';

/**
 * What the query cache needs from a key-value backend. Kept narrow so tests can inject an
 * in-memory fake and Redis stays swappable.
 */
export interface CacheStore {
	/** Current version counter of each key; `'0'` when the key has never been bumped. */
	getVersions(keys: string[]): Promise<string[]>;
	bumpVersion(key: string): Promise<void>;
	get(key: string): Promise<string | null>;
	set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

const ERROR_LOG_INTERVAL_MS = 30_000;
let lastErrorLogAt = 0;

/** Cache failures never break a request, but they shouldn't be silent or flood the log. */
export function reportCacheError(error: unknown): void {
	const now = Date.now();

	if (now - lastErrorLogAt < ERROR_LOG_INTERVAL_MS) {
		return;
	}

	lastErrorLogAt = now;
	const message = error instanceof Error ? error.message : String(error);
	console.warn(`[cache] Redis unavailable, falling back to the database: ${message}`);
}

const connections = new Map<string, Redis>();

function getConnection(url: string): Redis {
	const existing = connections.get(url);

	if (existing) {
		return existing;
	}

	const redis = new Redis(url, {
		// Fail fast instead of queueing commands while Redis is down: a request must fall back
		// to Postgres immediately, not wait for the cache.
		enableOfflineQueue: false,
		maxRetriesPerRequest: 1,
		commandTimeout: 250,
		retryStrategy: (attempt) => Math.min(attempt * 200, 5_000),
	});

	redis.on('error', reportCacheError);
	connections.set(url, redis);
	return redis;
}

/** One shared connection per Redis URL and process; all services' stores reuse it. */
export function createRedisCacheStore(url: string): CacheStore {
	const redis = getConnection(url);

	return {
		async getVersions(keys) {
			const values = await redis.mget(keys);
			return values.map((value) => value ?? '0');
		},
		async bumpVersion(key) {
			await redis.incr(key);
		},
		get: (key) => redis.get(key),
		async set(key, value, ttlSeconds) {
			await redis.set(key, value, 'EX', ttlSeconds);
		},
	};
}

/**
 * Redis URL from the environment: `REDIS_URL`, or the dev container on `REDIS_PORT`.
 * `undefined` means caching is off and the plain client is used.
 */
export function redisUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
	if (env.REDIS_URL) {
		return env.REDIS_URL;
	}

	return env.REDIS_PORT ? `redis://localhost:${env.REDIS_PORT}` : undefined;
}
