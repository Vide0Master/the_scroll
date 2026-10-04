import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HOTKEYS, moveSelection, shouldIgnoreHotkey } from '../scripts/hotkeys';
import { Popup } from './Popup';

const CARDS = 'article[data-post-id]';

function currentCard(cards: HTMLElement[]): number {
	const focused = document.activeElement?.closest(CARDS);
	return focused ? cards.indexOf(focused as HTMLElement) : -1;
}

// With nothing focused yet, start from the first card that is fully below the sticky header.
function firstVisibleCard(cards: HTMLElement[]): number {
	return cards.findIndex((card) => card.getBoundingClientRect().top >= 60);
}

function press(card: HTMLElement | undefined, action: string) {
	card?.querySelector<HTMLElement>(`[data-action='${action}']`)?.click();
}

/**
 * Keyboard shortcuts for reading: j/k move between posts, l likes, r replies, s copies the link,
 * / jumps to search, ? lists them. Renders only the help dialog.
 */
export function HotkeysHost() {
	const { t } = useTranslation();
	const [isHelpOpen, setIsHelpOpen] = useState(false);

	useEffect(() => {
		const handle = (event: KeyboardEvent) => {
			const isDialogOpen = document.querySelector('[role="dialog"]') !== null;

			if (shouldIgnoreHotkey(event, event.target as HTMLElement | null, isDialogOpen)) {
				return;
			}

			const cards = Array.from(document.querySelectorAll<HTMLElement>(CARDS));
			const index = currentCard(cards);
			const card = index >= 0 ? cards[index] : undefined;

			switch (event.key) {
				case 'j':
				case 'k': {
					const delta = event.key === 'j' ? 1 : -1;
					const from =
						index >= 0 ? index : firstVisibleCard(cards) - (delta === 1 ? 1 : 0);
					const target = cards[moveSelection(cards.length, from, delta)];

					if (target) {
						event.preventDefault();
						target.focus({ preventScroll: true });
						target.scrollIntoView({ block: 'center', behavior: 'smooth' });
					}
					break;
				}
				case 'l':
					press(card, 'like');
					break;
				case 'r':
					event.preventDefault();
					press(card, 'reply');
					break;
				case 's':
					press(card, 'share');
					break;
				case '/': {
					const search = document.querySelector<HTMLElement>('input[role="combobox"]');

					if (search) {
						event.preventDefault();
						search.focus();
					}
					break;
				}
				case '?':
					setIsHelpOpen(true);
					break;
			}
		};

		document.addEventListener('keydown', handle);
		return () => document.removeEventListener('keydown', handle);
	}, []);

	return (
		<Popup
			isOpen={isHelpOpen}
			onClose={() => setIsHelpOpen(false)}
			title={t('hotkeys.title')}
		>
			<dl className='flex flex-col gap-2 font-mono text-sm'>
				{HOTKEYS.map(({ keys, label }) => (
					<div
						key={keys}
						className='flex justify-between gap-4'
					>
						<dt className='text-accent'>{keys}</dt>
						<dd className='text-muted'>{t(label)}</dd>
					</div>
				))}
			</dl>
		</Popup>
	);
}
