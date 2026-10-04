/** What each shortcut is for: the key(s) as shown in the help, and the translation key of its meaning. */
export const HOTKEYS = [
	{ keys: 'j / k', label: 'hotkeys.nextPrev' },
	{ keys: 'l', label: 'hotkeys.like' },
	{ keys: 'r', label: 'hotkeys.reply' },
	{ keys: 's', label: 'hotkeys.share' },
	{ keys: '/', label: 'hotkeys.search' },
	{ keys: '?', label: 'hotkeys.help' },
] as const;

/** Index of the item to move to from `current` (-1 = none yet), one step, staying inside the list. */
export function moveSelection(count: number, current: number, delta: 1 | -1): number {
	if (count === 0) {
		return -1;
	}

	if (current < 0) {
		return delta === 1 ? 0 : count - 1;
	}

	return Math.min(count - 1, Math.max(0, current + delta));
}

interface KeyEventLike {
	key: string;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
}

interface TargetLike {
	tagName?: string;
	isContentEditable?: boolean;
}

/** Shortcuts stay out of the way while typing, with a modifier held, or with a dialog open. */
export function shouldIgnoreHotkey(
	event: KeyEventLike,
	target: TargetLike | null,
	isDialogOpen: boolean,
): boolean {
	if (event.ctrlKey || event.metaKey || event.altKey || isDialogOpen) {
		return true;
	}

	const tag = target?.tagName?.toLowerCase();

	return tag === 'input' || tag === 'textarea' || tag === 'select' || !!target?.isContentEditable;
}
