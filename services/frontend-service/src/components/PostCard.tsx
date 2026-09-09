import React from 'react';

export interface AuthorData {
	userID: string;
	userName: string;
	visibleName: string | null;
}

export interface PostCardProps {
	postID: string;
	authorID: string;
	author?: AuthorProfile | null;
	content: string;
	media?: string[];
	createdAt: string | Date;
}

export interface AuthorProfile {
	userID: string;
	userName: string;
	visibleName: string | null;
}

export function PostCard({ authorID, author, content, media = [], createdAt }: PostCardProps) {
	const formattedDate = new Date(createdAt).toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});

	const displayName = author?.visibleName || author?.userName || authorID.slice(0, 8);
	const usernameTag = author?.userName ? `@${author.userName}` : `@${authorID.slice(0, 8)}`;
	const avatarLetter = (author?.visibleName || author?.userName || authorID)[0].toUpperCase();

	return (
		<article className='flex flex-col gap-3 p-4 rounded-xl bg-surface-secondary/40 border border-border/20 w-full text-main select-none'>
			<div className='flex items-center gap-3'>
				<div className='w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold shrink-0 uppercase'>
					{avatarLetter}
				</div>

				<div className='flex flex-col min-w-0 leading-tight'>
					{author?.visibleName ? (
						<>
							<span className='font-medium text-sm truncate text-main'>
								{author.visibleName}
							</span>
							<span className='text-xs opacity-60 truncate'>
								{usernameTag} • {formattedDate}
							</span>
						</>
					) : (
						<>
							<span className='font-medium text-sm truncate text-main'>
								{usernameTag}
							</span>
							<span className='text-xs opacity-60 truncate'>{formattedDate}</span>
						</>
					)}
				</div>
			</div>

			{content && (
				<p className='text-sm leading-relaxed whitespace-pre-wrap text-main/90 break-words select-text'>
					{content}
				</p>
			)}

			{media.length > 0 && (
				<div
					className={`grid gap-2 rounded-lg overflow-hidden ${
						media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
					}`}
				>
					{media.map((url) => (
						<div
							key={url}
							className='bg-surface border border-border/20 rounded-lg overflow-hidden aspect-video'
						>
							<img
								src={url}
								alt='Attachment'
								className='w-full h-full object-cover'
							/>
						</div>
					))}
				</div>
			)}
		</article>
	);
}
