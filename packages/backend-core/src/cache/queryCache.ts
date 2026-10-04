import { decodeValue, encodeValue, hashQuery } from './serialize';
import { reportCacheError, type CacheStore } from './redisStore';

const READ_OPERATIONS = new Set([
	'findUnique',
	'findUniqueOrThrow',
	'findFirst',
	'findFirstOrThrow',
	'findMany',
	'count',
	'aggregate',
	'groupBy',
]);

const WRITE_OPERATIONS = new Set([
	'create',
	'createMany',
	'createManyAndReturn',
	'update',
	'updateMany',
	'updateManyAndReturn',
	'upsert',
	'delete',
	'deleteMany',
]);

// Key for the whole-database version, used when the model relation graph isn't available.
const GLOBAL_VERSION = '*';

export interface QueryCacheOptions {
	/** Key prefix, unique per service database (e.g. `posts`, `users`). */
	namespace: string;
	/** Safety net for entries that invalidation misses; invalidation itself is version-based. */
	ttlSeconds?: number;
	/** Models that must always hit Postgres (e.g. single-use tokens). Writes to them don't bump. */
	excludeModels?: string[];
}

interface RuntimeDataModel {
	models: Record<string, { fields: { kind: string; type: string }[] }>;
}

/**
 * Groups models that reference each other through relations. A cached read can embed related
 * rows (`include`, relation filters), so it must be invalidated by a write to any model in its
 * group. Returns `null` when the graph can't be read, which makes the cache fall back to one
 * version for the whole database: coarser, but never stale.
 */
function readRelationGroups(client: unknown): Map<string, string[]> | null {
	// Private Prisma field: the only place the relation graph is exposed at runtime.
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const dataModel = (client as { _runtimeDataModel?: RuntimeDataModel })._runtimeDataModel;

	if (!dataModel?.models) {
		return null;
	}

	const adjacency = new Map<string, Set<string>>();

	for (const name of Object.keys(dataModel.models)) {
		adjacency.set(name, new Set());
	}

	for (const [name, model] of Object.entries(dataModel.models)) {
		for (const field of model.fields) {
			if (field.kind === 'object' && adjacency.has(field.type)) {
				adjacency.get(name)?.add(field.type);
				adjacency.get(field.type)?.add(name);
			}
		}
	}

	const groups = new Map<string, string[]>();

	for (const name of adjacency.keys()) {
		if (groups.has(name)) {
			continue;
		}

		const component = new Set<string>([name]);
		const queue = [name];

		while (queue.length > 0) {
			for (const next of adjacency.get(queue.pop() as string) ?? []) {
				if (!component.has(next)) {
					component.add(next);
					queue.push(next);
				}
			}
		}

		const sorted = [...component].sort();

		for (const member of sorted) {
			groups.set(member, sorted);
		}
	}

	return groups;
}

interface OperationContext {
	model: string;
	operation: string;
	args: unknown;
	query: (args: unknown) => Promise<unknown>;
}

/**
 * Prisma client extension that serves reads from `store` and invalidates on writes.
 *
 * - Read: the key is the SHA-256 of `{ model, operation, args }` plus the current versions of the
 *   model's relation group. Hit: return the stored value. Miss: query Postgres through Prisma,
 *   then store the result under that key. The versions are read *before* the database query, so
 *   a write that lands mid-read makes the stored entry unreachable instead of stale.
 * - Write: run it, then bump the model's version counter, which orphans every cached read that
 *   could contain that model. Orphaned entries expire via TTL.
 * - Store failures fall back to the database; the cache is an optimisation, never a dependency.
 *
 * Limits: raw queries (`$queryRaw`, `$executeRaw`) bypass it. Inside an interactive
 * `$transaction` the version bumps before commit, so a concurrent read can briefly cache
 * pre-commit data until the TTL; keep security-sensitive models in `excludeModels`.
 * Values Prisma returns that JSON can't round-trip (Decimal) are simply not cached.
 */
export function createQueryCacheExtension(
	client: unknown,
	store: CacheStore,
	options: QueryCacheOptions,
) {
	const ttlSeconds = options.ttlSeconds ?? 60;
	const excluded = new Set(options.excludeModels ?? []);
	const groups = readRelationGroups(client);
	const versionKey = (model: string) => `${options.namespace}:v:${model}`;
	const versionKeysFor = (model: string) =>
		groups ? (groups.get(model) ?? [model]).map(versionKey) : [versionKey(GLOBAL_VERSION)];

	async function readThrough({ model, operation, args, query }: OperationContext) {
		let entryKey: string;

		try {
			const versions = await store.getVersions(versionKeysFor(model));
			entryKey = `${options.namespace}:q:${model}:${operation}:${hashQuery(model, operation, args)}:${versions.join('.')}`;
			const cached = await store.get(entryKey);

			if (cached !== null) {
				return decodeValue((JSON.parse(cached) as { v: unknown }).v);
			}
		} catch (error) {
			reportCacheError(error);
			return query(args);
		}

		const result = await query(args);

		try {
			const payload = JSON.stringify({ v: encodeValue(result) });
			store.set(entryKey, payload, ttlSeconds).catch(reportCacheError);
		} catch {
			// Not representable in JSON without loss: serve it uncached.
		}

		return result;
	}

	async function writeAndInvalidate({ model, args, query }: OperationContext) {
		const result = await query(args);

		try {
			await store.bumpVersion(versionKey(groups ? model : GLOBAL_VERSION));
		} catch (error) {
			reportCacheError(error);
		}

		return result;
	}

	return {
		name: 'redis-query-cache',
		query: {
			$allModels: {
				$allOperations(context: OperationContext) {
					if (excluded.has(context.model)) {
						return context.query(context.args);
					}

					if (READ_OPERATIONS.has(context.operation)) {
						return readThrough(context);
					}

					if (WRITE_OPERATIONS.has(context.operation)) {
						return writeAndInvalidate(context);
					}

					return context.query(context.args);
				},
			},
		},
	};
}
