/** Copies `text`; false when the browser refuses (no permission, insecure page). */
export async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		// Older browsers and non-secure pages: the classic way, through a hidden field.
		try {
			const field = document.createElement('textarea');
			field.value = text;
			field.setAttribute('readonly', '');
			field.style.position = 'fixed';
			field.style.opacity = '0';
			document.body.appendChild(field);
			field.select();
			const isCopied = document.execCommand('copy');
			field.remove();
			return isCopied;
		} catch {
			return false;
		}
	}
}
