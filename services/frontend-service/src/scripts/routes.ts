export function profilePath(userName: string): string {
	return `/u/${encodeURIComponent(userName)}`;
}

export function postPath(postID: string): string {
	return `/post/${encodeURIComponent(postID)}`;
}

/** Posts with a hashtag; `tag` is given without the leading "#". */
export function hashtagPath(tag: string): string {
	return `/hashtag/${encodeURIComponent(tag.toLowerCase())}`;
}
