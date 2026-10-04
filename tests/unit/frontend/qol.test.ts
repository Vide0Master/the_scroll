import { expect, test } from '@playwright/test';
import type { NotificationItem } from '@the-scroll/types';
import {
	moveSelection,
	shouldIgnoreHotkey,
} from '../../../services/frontend-service/src/scripts/hotkeys';
import { groupNotifications } from '../../../services/frontend-service/src/scripts/notifications';
import { pageTitle } from '../../../services/frontend-service/src/scripts/pageTitle';
import {
	MAX_RECENT_SEARCHES,
	withRecentSearch,
} from '../../../services/frontend-service/src/scripts/recentSearches';
import {
	readJSON,
	removeItem,
	writeJSON,
	type KeyValueStorage,
} from '../../../services/frontend-service/src/scripts/storage';
import {
	formatPostDate,
	formatRelative,
} from '../../../services/frontend-service/src/scripts/time';

const NOW = new Date('2026-09-27T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

test.describe('relative time', () => {
	test('under a minute reads as now, then the biggest unit that fits', () => {
		expect(formatRelative(ago(20 * 1000), 'en', NOW)).toBe('now');
		expect(formatRelative(ago(5 * MINUTE), 'en', NOW)).toBe('5 min. ago');
		expect(formatRelative(ago(3 * HOUR), 'en', NOW)).toBe('3 hr. ago');
		expect(formatRelative(ago(DAY), 'en', NOW)).toBe('yesterday');
	});

	test('a timestamp from the future (clock skew) counts as now', () => {
		expect(formatRelative(new Date(NOW + 5 * MINUTE).toISOString(), 'en', NOW)).toBe('now');
	});

	test('a post older than a week shows its date, with the year only for another year', () => {
		expect(formatPostDate(ago(2 * DAY), 'en', NOW)).toBe('2 days ago');
		expect(formatPostDate('2026-09-01T10:00:00Z', 'en', NOW)).toBe('Sep 1');
		expect(formatPostDate('2025-03-05T10:00:00Z', 'en', NOW)).toBe('Mar 5, 2025');
	});
});

test.describe('browser storage helpers', () => {
	const fake = (): KeyValueStorage & { data: Map<string, string> } => {
		const data = new Map<string, string>();
		return {
			data,
			getItem: (key) => data.get(key) ?? null,
			setItem: (key, value) => void data.set(key, value),
			removeItem: (key) => void data.delete(key),
		};
	};
	const isNumber = (value: unknown): value is number => typeof value === 'number';

	test('reads back what was written, under the versioned prefix', () => {
		const storage = fake();
		writeJSON('n', 5, storage);

		expect([...storage.data.keys()]).toEqual(['scroll:v1:n']);
		expect(readJSON('n', 0, isNumber, storage)).toBe(5);

		removeItem('n', storage);
		expect(readJSON('n', 7, isNumber, storage)).toBe(7);
	});

	test('falls back on garbage, on another shape and on a missing or throwing storage', () => {
		const storage = fake();
		storage.data.set('scroll:v1:n', 'not json');
		expect(readJSON('n', 1, isNumber, storage)).toBe(1);

		storage.data.set('scroll:v1:n', '"text"');
		expect(readJSON('n', 2, isNumber, storage)).toBe(2);

		expect(readJSON('n', 3, isNumber, null)).toBe(3);

		const blocked: KeyValueStorage = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			},
			removeItem: () => {
				throw new Error('blocked');
			},
		};
		expect(readJSON('n', 4, isNumber, blocked)).toBe(4);
		expect(() => writeJSON('n', 1, blocked)).not.toThrow();
		expect(() => removeItem('n', blocked)).not.toThrow();
	});
});

test.describe('keyboard shortcuts', () => {
	test('j/k move one post at a time and stay inside the list', () => {
		expect(moveSelection(0, -1, 1)).toBe(-1);
		expect(moveSelection(5, -1, 1)).toBe(0);
		expect(moveSelection(5, -1, -1)).toBe(4);
		expect(moveSelection(5, 2, 1)).toBe(3);
		expect(moveSelection(5, 4, 1)).toBe(4);
		expect(moveSelection(5, 0, -1)).toBe(0);
	});

	test('are ignored while typing, with a modifier or with a dialog open', () => {
		const key = { key: 'j', ctrlKey: false, metaKey: false, altKey: false };

		expect(shouldIgnoreHotkey(key, { tagName: 'BODY' }, false)).toBe(false);
		expect(shouldIgnoreHotkey(key, { tagName: 'TEXTAREA' }, false)).toBe(true);
		expect(shouldIgnoreHotkey(key, { tagName: 'INPUT' }, false)).toBe(true);
		expect(shouldIgnoreHotkey(key, { tagName: 'DIV', isContentEditable: true }, false)).toBe(
			true,
		);
		expect(shouldIgnoreHotkey({ ...key, ctrlKey: true }, { tagName: 'BODY' }, false)).toBe(
			true,
		);
		expect(shouldIgnoreHotkey(key, { tagName: 'BODY' }, true)).toBe(true);
	});
});

test.describe('tab title', () => {
	const label = (section: string) => section.toUpperCase();

	test('names the page, and shows unread notifications first', () => {
		expect(pageTitle('/', 0, label)).toBe('HOME · The Scroll');
		expect(pageTitle('/u/ann', 0, label)).toBe('@ann · The Scroll');
		expect(pageTitle('/hashtag/news', 3, label)).toBe('(3) #news · The Scroll');
		expect(pageTitle('/notifications', 150, label)).toBe('(99+) NOTIFICATIONS · The Scroll');
		expect(pageTitle('/auth/login', 0, label)).toBe('The Scroll');
	});
});

test.describe('recent searches', () => {
	test('the newest goes first, repeats (any case) collapse, the list stays short', () => {
		expect(withRecentSearch(['b', 'a'], 'A')).toEqual(['A', 'b']);
		expect(withRecentSearch(['a'], '   ')).toEqual(['a']);

		let list: string[] = [];
		for (let n = 0; n < MAX_RECENT_SEARCHES + 3; n++) {
			list = withRecentSearch(list, `q${n}`);
		}
		expect(list).toHaveLength(MAX_RECENT_SEARCHES);
		expect(list[0]).toBe(`q${MAX_RECENT_SEARCHES + 2}`);
	});
});

test.describe('grouping notifications', () => {
	const item = (
		id: string,
		type: NotificationItem['type'],
		postID: string | null,
		isRead = false,
	) =>
		({
			id,
			type,
			postID,
			isRead,
			createdAt: '2026-09-27T10:00:00Z',
			actor: { userID: id, userName: `u${id}`, visibleName: null, avatarUrl: null },
		}) as NotificationItem;

	test('likes of one post become one row; other kinds and other posts stay apart', () => {
		const groups = groupNotifications([
			item('1', 'LIKE', 'p1'),
			item('2', 'REPLY', 'p9'),
			item('3', 'LIKE', 'p1', true),
			item('4', 'LIKE', 'p2'),
			item('5', 'FOLLOW', null),
		]);

		expect(groups.map((group) => group.items.map((i) => i.id))).toEqual([
			['1', '3'],
			['2'],
			['4'],
			['5'],
		]);
		expect(groups[0].latest.id).toBe('1');
		// Unread until every like in it has been seen.
		expect(groups[0].isRead).toBe(false);
	});
});
