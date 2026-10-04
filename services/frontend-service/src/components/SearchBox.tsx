import { useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClockIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Avatar } from '../elements/Avatar';
import { hashtagPath, profilePath } from '../scripts/routes';
import { clearRecentSearches, readRecentSearches, rememberSearch } from '../scripts/recentSearches';
import { searchPath } from '../scripts/search';
import { useSearchSuggestions } from '../scripts/useSearchSuggestions';
import { rankByTrend, useTrending } from '../scripts/useTrending';

export interface SearchBoxProps {
	/** Text to start with, e.g. the query of the search page that shows the box. */
	initialValue?: string;
	autoFocus?: boolean;
}

interface Option {
	key: string;
	to: string;
	node: React.ReactNode;
}

/**
 * The search field with live hints: matching people and hashtags, and a row that runs the full
 * search. Enter runs the search, or opens the highlighted hint; arrows move, Escape closes.
 */
export function SearchBox({ initialValue = '', autoFocus = false }: SearchBoxProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [value, setValue] = useState(initialValue);
	const [isOpen, setIsOpen] = useState(false);
	const [highlighted, setHighlighted] = useState(-1);
	const [recent, setRecent] = useState<string[]>([]);
	const found = useSearchSuggestions(value);
	const trending = useTrending();
	const query = value.trim();
	// Empty field: offer what is trending. Typed text: the matches, popular ones first.
	const users = query
		? rankByTrend(
				found.users,
				(user) => user.userID,
				trending.users.map(({ user }) => user.userID),
			)
		: trending.users.map(({ user }) => user);
	const tags = query
		? rankByTrend(
				found.tags,
				(entry) => entry.tag,
				trending.tags.map(({ tag }) => tag),
			)
		: trending.tags.map(({ tag, score }) => ({ tag, count: score }));

	const options: Option[] = [
		...(query
			? []
			: recent.map((text) => ({
					key: `recent:${text}`,
					to: searchPath(text),
					node: (
						<span className='flex items-center gap-2 font-mono text-sm min-w-0'>
							<ClockIcon
								className='w-4 h-4 shrink-0 text-muted'
								strokeWidth={1.25}
							/>
							<span className='truncate'>{text}</span>
						</span>
					),
				}))),
		...users.map((user) => ({
			key: `user:${user.userID}`,
			to: profilePath(user.userName),
			node: (
				<>
					<Avatar
						name={user.visibleName || user.userName}
						src={user.avatarUrl}
						size='sm'
					/>
					<span className='flex flex-col min-w-0 leading-tight font-mono text-xs'>
						<span className='font-semibold uppercase tracking-wide truncate'>
							{user.visibleName || user.userName}
						</span>
						<span className='text-muted truncate'>@{user.userName}</span>
					</span>
				</>
			),
		})),
		...tags.map(({ tag, count }) => ({
			key: `tag:${tag}`,
			to: hashtagPath(tag),
			node: (
				<span className='flex items-baseline gap-2 font-mono text-sm min-w-0'>
					<span className='text-accent truncate'>#{tag}</span>
					<span className='text-xs text-muted'>
						{t(query ? 'search.postsCount' : 'widgets.reactions', { count })}
					</span>
				</span>
			),
		})),
		...(query
			? [
					{
						key: 'all',
						to: searchPath(query),
						node: (
							<span className='font-mono text-xs uppercase tracking-wide truncate'>
								{t('search.searchFor', { query })}
							</span>
						),
					},
				]
			: []),
	];
	const active = Math.min(highlighted, options.length - 1);

	const go = (to: string) => {
		// Remember searches that were actually run (typed, or picked from the recent list).
		if (to.startsWith('/search')) {
			const text = new URLSearchParams(to.split('?')[1]).get('q');

			if (text) {
				setRecent(rememberSearch(text));
			}
		}

		setIsOpen(false);
		setHighlighted(-1);
		navigate(to);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			setIsOpen(true);
			const step = event.key === 'ArrowDown' ? 1 : -1;
			// -1 is the field itself (nothing highlighted), then the options in order.
			const slots = options.length + 1;
			setHighlighted(((active + 1 + step + slots) % slots) - 1);
		} else if (event.key === 'Enter' && query) {
			event.preventDefault();
			go(active >= 0 ? options[active].to : searchPath(query));
		} else if (event.key === 'Escape') {
			setIsOpen(false);
		}
	};

	return (
		<div className='relative'>
			<div className='flex items-center gap-3 bg-panel border border-line px-4 py-2.5 text-muted focus-within:border-accent'>
				<MagnifyingGlassIcon
					className='w-5 h-5 shrink-0'
					strokeWidth={1.25}
				/>
				<input
					role='combobox'
					aria-expanded={isOpen && options.length > 0}
					aria-controls='search-hints'
					aria-autocomplete='list'
					autoFocus={autoFocus}
					value={value}
					onChange={(event) => {
						setValue(event.target.value);
						setHighlighted(-1);
						setIsOpen(true);
					}}
					onFocus={() => {
						setRecent(readRecentSearches());
						setIsOpen(true);
					}}
					onBlur={() => setIsOpen(false)}
					onKeyDown={handleKeyDown}
					maxLength={100}
					aria-label={t('widgets.search')}
					placeholder={t('widgets.search')}
					className='w-full bg-transparent outline-none text-main placeholder:text-muted font-mono text-sm'
				/>
			</div>

			{isOpen && options.length > 0 && (
				<ul
					id='search-hints'
					role='listbox'
					className='absolute left-0 right-0 top-full z-30 bg-surface border border-line'
				>
					{options.map((option, index) => (
						<li
							key={option.key}
							role='option'
							aria-selected={index === active}
						>
							<button
								type='button'
								// Keeps focus in the field: the click must land before the blur closes the list.
								onMouseDown={(event) => event.preventDefault()}
								onMouseEnter={() => setHighlighted(index)}
								onClick={() => go(option.to)}
								className={`flex items-center gap-3 w-full px-3 py-2 text-left ${
									index === active ? 'bg-hover' : ''
								}`}
							>
								{option.node}
							</button>
						</li>
					))}
					{!query && recent.length > 0 && (
						<li className='flex justify-end border-t border-line px-3 py-1'>
							<button
								type='button'
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => {
									clearRecentSearches();
									setRecent([]);
								}}
								className='bg-none border-none p-0 font-mono text-xs uppercase text-muted hover:underline'
							>
								{t('search.clearRecent')}
							</button>
						</li>
					)}
				</ul>
			)}
		</div>
	);
}
