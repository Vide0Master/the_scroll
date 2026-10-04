import { Link } from 'react-router-dom';
import { splitTextEntities } from '@the-scroll/types';
import { hashtagPath, profilePath } from '../scripts/routes';

export interface RichTextProps {
	text: string;
	/** Usernames that are real accounts (from the server); other @names stay plain text. */
	mentions: string[];
}

/**
 * Post text with #hashtags and existing @users turned into links. The links opt back into
 * pointer events (`pointer-events-auto`) because the card around them lets clicks fall through
 * to its whole-card link.
 */
export function RichText({ text, mentions }: RichTextProps) {
	return (
		<>
			{splitTextEntities(text).map((segment, index) => {
				if (segment.type === 'hashtag') {
					return (
						<Link
							key={index}
							to={hashtagPath(segment.value)}
							className='pointer-events-auto text-accent hover:underline'
						>
							#{segment.value}
						</Link>
					);
				}

				if (segment.type === 'mention' && mentions.includes(segment.value)) {
					return (
						<Link
							key={index}
							to={profilePath(segment.value)}
							className='pointer-events-auto font-semibold text-accent hover:underline'
						>
							@{segment.value}
						</Link>
					);
				}

				return (
					<span key={index}>
						{/* Plain text, or an @name that is not an account. */}
						{segment.type === 'text' ? segment.value : `@${segment.value}`}
					</span>
				);
			})}
		</>
	);
}
