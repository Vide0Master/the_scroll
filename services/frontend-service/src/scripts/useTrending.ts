import { useEffect, useState } from 'react';
import type { TrendingTag, TrendingUser } from '@the-scroll/types';
import { api } from './api';

export interface Trends {
	tags: TrendingTag[];
	users: TrendingUser[];
}

const NONE: Trends = { tags: [], users: [] };
const REFRESH_MS = 60 * 1000;
const TRENDS_LIMIT = 5;

// Shared by every widget that shows trends, so a page with several asks the server once a minute.
let latest: { at: number; trends: Trends } | null = null;
let pending: Promise<Trends> | null = null;

async function loadTrends(): Promise<Trends> {
	if (latest && Date.now() - latest.at < REFRESH_MS) {
		return latest.trends;
	}

	pending ??= api.posts
		.trending(TRENDS_LIMIT)
		.then(({ tags, users }) => {
			latest = { at: Date.now(), trends: { tags, users } };
			return latest.trends;
		})
		// Trends are decoration: when they can't load the widgets simply stay empty.
		.catch(() => latest?.trends ?? NONE)
		.finally(() => {
			pending = null;
		});

	return pending;
}

/** Hashtags and accounts with the most likes and replies lately (empty until loaded). */
export function useTrending(): Trends {
	const [trends, setTrends] = useState<Trends>(latest?.trends ?? NONE);

	useEffect(() => {
		let isActive = true;

		void loadTrends().then((loaded) => {
			if (isActive) {
				setTrends(loaded);
			}
		});

		return () => {
			isActive = false;
		};
	}, []);

	return trends;
}

/**
 * Moves the entries that are trending to the front, in trending order, keeping the rest as they
 * were: popular accounts and tags are suggested first.
 */
export function rankByTrend<T>(items: T[], keyOf: (item: T) => string, trending: string[]): T[] {
	const rank = new Map(trending.map((key, index) => [key, index]));

	return items
		.map((item, index) => ({ item, index, rank: rank.get(keyOf(item)) ?? Infinity }))
		.sort((a, b) => a.rank - b.rank || a.index - b.index)
		.map(({ item }) => item);
}
