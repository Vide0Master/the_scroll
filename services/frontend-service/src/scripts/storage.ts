/** Keys of everything this app keeps in the browser, versioned so a format change can move on. */
export const STORAGE_PREFIX = 'scroll:v1:';

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** `localStorage`, or null where the browser refuses it (private mode, blocked site data). */
export function getBrowserStorage(): Storage | null {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

/** The stored JSON value of `key`, or `fallback` when missing, unreadable or of another shape. */
export function readJSON<T>(
	key: string,
	fallback: T,
	isValid: (value: unknown) => value is T,
	storage: KeyValueStorage | null = getBrowserStorage(),
): T {
	try {
		const raw = storage?.getItem(STORAGE_PREFIX + key);

		if (raw) {
			const parsed: unknown = JSON.parse(raw);

			if (isValid(parsed)) {
				return parsed;
			}
		}
	} catch {
		/* unreadable: treated as absent */
	}

	return fallback;
}

/** Stores `value`; a full or blocked storage just means it is not remembered. */
export function writeJSON(
	key: string,
	value: unknown,
	storage: KeyValueStorage | null = getBrowserStorage(),
): void {
	try {
		storage?.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
	} catch {
		/* not remembered */
	}
}

export function removeItem(
	key: string,
	storage: KeyValueStorage | null = getBrowserStorage(),
): void {
	try {
		storage?.removeItem(STORAGE_PREFIX + key);
	} catch {
		/* nothing to remove */
	}
}
