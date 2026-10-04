import type { UserProfile } from '@the-scroll/types';
import { Avatar } from '../elements/Avatar';

export interface MentionSuggestionsProps {
	users: UserProfile[];
	activeIndex: number;
	onSelect: (user: UserProfile) => void;
	onHover: (index: number) => void;
}

/** Dropdown of accounts offered while typing an @name; the textarea keeps focus and drives the keys. */
export function MentionSuggestions({
	users,
	activeIndex,
	onSelect,
	onHover,
}: MentionSuggestionsProps) {
	return (
		<ul
			role='listbox'
			className='absolute left-4 right-4 top-full z-20 bg-surface border border-line'
		>
			{users.map((user, index) => (
				<li
					key={user.userID}
					role='option'
					aria-selected={index === activeIndex}
				>
					<button
						type='button'
						// Keeps the caret in the textarea: a click must not move focus to the button.
						onMouseDown={(event) => event.preventDefault()}
						onMouseEnter={() => onHover(index)}
						onClick={() => onSelect(user)}
						className={`flex items-center gap-3 w-full px-3 py-2 text-left ${
							index === activeIndex ? 'bg-hover' : ''
						}`}
					>
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
					</button>
				</li>
			))}
		</ul>
	);
}
