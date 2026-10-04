export interface PixelArea {
	x: number;
	y: number;
	width: number;
	height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('The image could not be read'));
		image.src = src;
	});
}

/**
 * Cuts `area` out of the image and scales it to `output`. The canvas starts fully transparent
 * and PNG/WebP keep the alpha channel, so a transparent avatar stays transparent. Browsers
 * that can't encode WebP fall back to PNG, which is why the result's own `type` is what counts.
 */
export async function cropImage(
	src: string,
	area: PixelArea,
	output: { width: number; height: number },
	mimeType: 'image/png' | 'image/webp',
): Promise<Blob> {
	const image = await loadImage(src);
	const canvas = document.createElement('canvas');
	canvas.width = output.width;
	canvas.height = output.height;

	const context = canvas.getContext('2d');

	if (!context) {
		throw new Error('Canvas is not available');
	}

	context.imageSmoothingQuality = 'high';
	context.drawImage(
		image,
		area.x,
		area.y,
		area.width,
		area.height,
		0,
		0,
		output.width,
		output.height,
	);

	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('The image could not be encoded'))),
			mimeType,
			0.92,
		);
	});
}

/** A file name whose extension matches the blob's real type; the media-service keeps it. */
export function fileNameFor(base: string, blob: Blob): string {
	return `${base}.${blob.type === 'image/webp' ? 'webp' : 'png'}`;
}
