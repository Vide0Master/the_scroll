export const APP_NAME = 'The Scroll';

/**
 * The tab title for a path: the page's name (a profile is "@name", a hashtag "#tag") plus the
 * app name, with the number of unread notifications in front when there are any. `label` maps a
 * section to its translated name.
 */
export function pageTitle(
	pathname: string,
	unreadCount: number,
	label: (section: 'home' | 'notifications' | 'search' | 'settings' | 'admin' | 'post') => string,
): string {
	const [section = '', name = ''] = pathname.split('/').filter(Boolean);
	let page: string;

	switch (section) {
		case '':
			page = label('home');
			break;
		case 'notifications':
		case 'search':
		case 'settings':
		case 'admin':
		case 'post':
			page = label(section);
			break;
		case 'u':
			page = `@${safeDecode(name)}`;
			break;
		case 'hashtag':
			page = `#${safeDecode(name)}`;
			break;
		default:
			return APP_NAME;
	}

	const unread = unreadCount > 0 ? `(${unreadCount > 99 ? '99+' : unreadCount}) ` : '';

	return `${unread}${page} · ${APP_NAME}`;
}

function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
