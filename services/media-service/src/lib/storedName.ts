// `<uuid>.<extension>`: the only file names media-service creates and the only ones it touches.
const STORED_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,8}$/;
const FILE_URL = /^\/api\/media\/file\/([^/?#]+)$/;

// The extension comes from the checked MIME type, never from the client's file name.
const EXTENSION_BY_MIME = new Map<string, string>([
	['image/jpeg', 'jpg'],
	['image/png', 'png'],
	['image/webp', 'webp'],
	['image/gif', 'gif'],
	['video/mp4', 'mp4'],
	['video/webm', 'webm'],
	['video/quicktime', 'mov'],
]);

export const ALLOWED_MIME_TYPES = [...EXTENSION_BY_MIME.keys()];

export function extensionForMime(mimeType: string): string | undefined {
	return EXTENSION_BY_MIME.get(mimeType);
}

export function mimeForExtension(storedName: string): string {
	const extension = storedName.slice(storedName.lastIndexOf('.') + 1);
	const entry = [...EXTENSION_BY_MIME].find(([, value]) => value === extension);

	return entry ? entry[0] : 'application/octet-stream';
}

export function isStoredName(value: string): boolean {
	return STORED_NAME.test(value);
}

/** The stored name behind a public `/api/media/file/...` URL, or `null` for anything else. */
export function storedNameFromUrl(url: string): string | null {
	const name = FILE_URL.exec(url)?.[1];

	return name && isStoredName(name) ? name : null;
}
