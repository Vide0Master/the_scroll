import { useSyncExternalStore } from 'react';

const MINUTE = 60 * 1000;
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 365 * 24 * 60 * MINUTE],
	['month', 30 * 24 * 60 * MINUTE],
	['week', 7 * 24 * 60 * MINUTE],
	['day', 24 * 60 * MINUTE],
	['hour', 60 * MINUTE],
	['minute', MINUTE],
];

/**
 * "5 min. ago", "yesterday", "3 wk. ago": the biggest unit that fits, in the reader's language.
 * Under a minute reads as "now"; a timestamp slightly in the future (clock skew) counts as now.
 */
export function formatRelative(iso: string, language: string, now: number = Date.now()): string {
	const diff = new Date(iso).getTime() - now;
	const formatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto', style: 'short' });

	if (Math.abs(diff) < MINUTE || diff > 0) {
		return formatter.format(0, 'second');
	}

	for (const [unit, size] of UNITS) {
		if (Math.abs(diff) >= size) {
			return formatter.format(Math.round(diff / size), unit);
		}
	}

	return formatter.format(0, 'second');
}

/**
 * How a post's age reads in a list: relative for the last week ("5 min. ago"), then the date
 * (with the year only when it is not this year).
 */
export function formatPostDate(iso: string, language: string, now: number = Date.now()): string {
	const date = new Date(iso);

	if (now - date.getTime() < 7 * 24 * 60 * MINUTE) {
		return formatRelative(iso, language, now);
	}

	const isThisYear = date.getFullYear() === new Date(now).getFullYear();

	return date.toLocaleDateString(language, {
		month: 'short',
		day: 'numeric',
		...(isThisYear ? {} : { year: 'numeric' }),
	});
}

/** The exact moment, for a tooltip. */
export function formatFull(iso: string, language: string): string {
	return new Date(iso).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' });
}

// One shared minute timer for every relative time on the page, however many cards show one.
const listeners = new Set<() => void>();
let tick = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
	listeners.add(listener);
	timer ??= setInterval(() => {
		tick = Date.now();
		listeners.forEach((notify) => notify());
	}, MINUTE);

	return () => {
		listeners.delete(listener);

		if (listeners.size === 0 && timer) {
			clearInterval(timer);
			timer = null;
		}
	};
}

/** The current time, refreshed once a minute (for relative timestamps). */
export function useNow(): number {
	return useSyncExternalStore(subscribe, () => tick);
}
