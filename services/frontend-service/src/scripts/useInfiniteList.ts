import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { FeedPost } from '@the-scroll/types';

export interface Page<T> {
	posts?: T[];
	items?: T[];
	nextCursor?: string;
}

interface ListState<T> {
	items: T[];
	cursor?: string;
	hasMore: boolean;
	isLoading: boolean;
	isLoadingMore: boolean;
	hasFailed: boolean;
	/** What the last failed request threw (kept so a page can tell a refusal from an outage). */
	error?: unknown;
	/** When the first page was fetched; a list older than `FRESH_MS` is fetched again. */
	at: number;
	/** Where the page was scrolled to, so coming back lands there. Written without a re-render. */
	scrollY: number;
}

// The lists live outside React, keyed by name: leaving a page and coming back (browser back, a
// click on the logo) shows the same posts at the same scroll position instead of starting over.
const lists = new Map<string, ListState<never>>();
const listeners = new Map<string, Set<() => void>>();
const inFlight = new Set<string>();
const FRESH_MS = 2 * 60 * 1000;
const MAX_LISTS = 30;

const EMPTY: ListState<never> = {
	items: [],
	hasMore: false,
	isLoading: true,
	isLoadingMore: false,
	hasFailed: false,
	at: 0,
	scrollY: 0,
};

const read = <T>(key: string) => (lists.get(key) ?? EMPTY) as ListState<T>;

function write<T>(key: string, patch: Partial<ListState<T>>) {
	const next = { ...read<T>(key), ...patch } as ListState<never>;

	// Map order is recency order: the first entry is the one least recently touched.
	lists.delete(key);
	lists.set(key, next);

	while (lists.size > MAX_LISTS) {
		lists.delete(lists.keys().next().value as string);
	}

	listeners.get(key)?.forEach((notify) => notify());
}

const pageItems = <T>(page: Page<T>): T[] => page.items ?? page.posts ?? [];

async function loadFirst<T>(key: string, load: (cursor?: string) => Promise<Page<T>>) {
	if (inFlight.has(key)) {
		return;
	}

	inFlight.add(key);
	// Whatever is already shown stays while the fresh first page loads.
	write<T>(key, { isLoading: read<T>(key).items.length === 0, hasFailed: false });

	try {
		const page = await load();
		write<T>(key, {
			items: pageItems(page),
			cursor: page.nextCursor,
			hasMore: !!page.nextCursor,
			isLoading: false,
			isLoadingMore: false,
			hasFailed: false,
			at: Date.now(),
		});
	} catch (error) {
		write<T>(key, { isLoading: false, hasFailed: true, error, at: 0 });
	} finally {
		inFlight.delete(key);
	}
}

async function loadNext<T>(
	key: string,
	load: (cursor?: string) => Promise<Page<T>>,
	getID: (item: T) => string,
) {
	const current = read<T>(key);

	if (inFlight.has(key) || !current.hasMore) {
		return;
	}

	inFlight.add(key);
	write<T>(key, { isLoadingMore: true, hasFailed: false });

	try {
		const page = await load(current.cursor);
		const known = new Set(read<T>(key).items.map(getID));
		write<T>(key, {
			// Keyset paging never repeats a row, but an item added locally might come back.
			items: [...read<T>(key).items, ...pageItems(page).filter((i) => !known.has(getID(i)))],
			cursor: page.nextCursor,
			hasMore: !!page.nextCursor,
			isLoadingMore: false,
		});
	} catch (error) {
		write<T>(key, { isLoadingMore: false, hasFailed: true, error });
	} finally {
		inFlight.delete(key);
	}
}

/** Puts `item` at the top of the named list (also when nobody is showing it right now). */
export function prependToList<T>(key: string, item: T, getID: (item: T) => string) {
	const current = lists.get(key) as ListState<T> | undefined;

	if (current && !current.items.some((existing) => getID(existing) === getID(item))) {
		write<T>(key, { items: [item, ...current.items] });
	}
}

/** Where the named list was last scrolled to (0 for one never seen). */
export const scrollPositionOf = (key: string) => lists.get(key)?.scrollY ?? 0;

export interface InfiniteList<T> {
	items: T[];
	isLoading: boolean;
	isLoadingMore: boolean;
	hasMore: boolean;
	hasFailed: boolean;
	error?: unknown;
	/** Asks for the next page (the end of the list scrolled into view). */
	loadMore: () => void;
	/** Fetches the first page again and swaps it in, keeping the list on screen meanwhile. */
	reload: () => void;
	prepend: (item: T) => void;
	patch: (id: string, update: (item: T) => T) => void;
	/** The name of the list (see `scrollPositionOf`). */
	key: string;
}

/**
 * A list that loads its next page on demand. `key` names the list (a new key is a new list);
 * `load` may change every render, the latest one is used. Lists are kept for a couple of minutes,
 * so returning to one is instant; after that it is fetched again.
 */
export function useInfiniteList<T>(
	key: string,
	load: (cursor?: string) => Promise<Page<T>>,
	getID: (item: T) => string,
): InfiniteList<T> {
	const loadRef = useRef(load);
	const getIDRef = useRef(getID);

	useEffect(() => {
		loadRef.current = load;
		getIDRef.current = getID;
	});

	const subscribe = useCallback(
		(notify: () => void) => {
			const set = listeners.get(key) ?? new Set();
			set.add(notify);
			listeners.set(key, set);

			return () => {
				set.delete(notify);
			};
		},
		[key],
	);
	const state = useSyncExternalStore(subscribe, () => read<T>(key));
	useEffect(() => {
		const entry = lists.get(key);

		if (!entry || Date.now() - entry.at > FRESH_MS) {
			void loadFirst(key, (cursor) => loadRef.current(cursor));
		}
	}, [key]);

	// Remember the scroll position (layout effect: stops listening before the next page's content
	// changes the scroll height).
	useLayoutEffect(() => {
		const remember = () => {
			const entry = lists.get(key);

			if (entry && !entry.isLoading) {
				entry.scrollY = window.scrollY;
			}
		};

		window.addEventListener('scroll', remember, { passive: true });
		return () => window.removeEventListener('scroll', remember);
	}, [key]);

	const loadMore = useCallback(
		() =>
			void loadNext(
				key,
				(cursor) => loadRef.current(cursor),
				(i) => getIDRef.current(i),
			),
		[key],
	);
	const reload = useCallback(
		() => void loadFirst(key, (cursor) => loadRef.current(cursor)),
		[key],
	);
	const prepend = useCallback(
		(item: T) => prependToList(key, item, (i) => getIDRef.current(i)),
		[key],
	);
	const patch = useCallback(
		(id: string, update: (item: T) => T) => {
			const current = lists.get(key) as ListState<T> | undefined;

			if (current?.items.some((item) => getIDRef.current(item) === id)) {
				write<T>(key, {
					items: current.items.map((item) =>
						getIDRef.current(item) === id ? update(item) : item,
					),
				});
			}
		},
		[key],
	);

	return {
		items: state.items,
		isLoading: state.isLoading,
		isLoadingMore: state.isLoadingMore,
		hasMore: state.hasMore,
		hasFailed: state.hasFailed,
		error: state.error,
		loadMore,
		reload,
		prepend,
		patch,
		key,
	};
}

/** The list of posts variant: posts are identified by `postID`. */
export function usePostList(
	key: string,
	load: (cursor?: string) => Promise<Page<FeedPost>>,
): InfiniteList<FeedPost> {
	return useInfiniteList(key, load, postID);
}

export const postID = (post: FeedPost) => post.postID;

/** Puts a post at the top of a named post list. */
export const prependPost = (key: string, post: FeedPost) => prependToList(key, post, postID);
