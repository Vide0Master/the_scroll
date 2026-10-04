import { createHash } from 'node:crypto';

// Marks values JSON can't carry natively. A plain object that already uses this key is wrapped
// too, so user-controlled Json columns can never be mistaken for a tagged value on decode.
const TAG = '$__t';

/**
 * Converts a Prisma args/result value to a JSON-safe shape, tagging Date, BigInt and bytes.
 * Throws on anything it can't round-trip exactly (Decimal, NaN, class instances such as
 * `Prisma.DbNull`); callers treat that as "don't cache this query".
 */
export function encodeValue(value: unknown): unknown {
	if (value === null || value === undefined) {
		return value;
	}

	switch (typeof value) {
		case 'string':
		case 'boolean':
			return value;
		case 'number':
			if (!Number.isFinite(value)) {
				throw new Error('Non-finite number is not cacheable');
			}
			return value;
		case 'bigint':
			return { [TAG]: 'bigint', v: value.toString() };
		case 'object':
			break;
		default:
			throw new Error(`Unsupported value type: ${typeof value}`);
	}

	if (value instanceof Date) {
		return { [TAG]: 'date', v: value.toISOString() };
	}

	if (value instanceof Uint8Array) {
		return { [TAG]: 'bytes', v: Buffer.from(value).toString('base64') };
	}

	if (Array.isArray(value)) {
		return value.map(encodeValue);
	}

	const prototype = Object.getPrototypeOf(value);

	if (prototype !== Object.prototype && prototype !== null) {
		throw new Error('Non-plain object is not cacheable');
	}

	const encoded: Record<string, unknown> = {};

	for (const [key, entry] of Object.entries(value)) {
		encoded[key] = encodeValue(entry);
	}

	return TAG in encoded ? { [TAG]: 'obj', v: encoded } : encoded;
}

/** Inverse of `encodeValue`. */
export function decodeValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(decodeValue);
	}

	if (value === null || typeof value !== 'object') {
		return value;
	}

	const record = value as Record<string, unknown>;

	if (TAG in record) {
		const payload = record.v;

		switch (record[TAG]) {
			case 'date':
				return new Date(payload as string);
			case 'bigint':
				return BigInt(payload as string);
			case 'bytes':
				return Buffer.from(payload as string, 'base64');
			case 'obj':
				return decodeRecord(payload as Record<string, unknown>);
		}
	}

	return decodeRecord(record);
}

function decodeRecord(record: Record<string, unknown>): Record<string, unknown> {
	const decoded: Record<string, unknown> = {};

	for (const [key, entry] of Object.entries(record)) {
		decoded[key] = decodeValue(entry);
	}

	return decoded;
}

// Sorted keys make `{ a, b }` and `{ b, a }` hash to the same cache key.
function stableStringify(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map((entry) => stableStringify(entry ?? null)).join(',')}]`;
	}

	if (value !== null && typeof value === 'object') {
		const record = value as Record<string, unknown>;
		const parts = Object.keys(record)
			.filter((key) => record[key] !== undefined)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);

		return `{${parts.join(',')}}`;
	}

	return JSON.stringify(value);
}

/** SHA-256 of the query identity; the Redis key of a cached read is derived from it. */
export function hashQuery(model: string, operation: string, args: unknown): string {
	const canonical = stableStringify(encodeValue({ model, operation, args }));
	return createHash('sha256').update(canonical).digest('hex');
}
