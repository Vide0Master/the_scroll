import type { BannerGradient } from '@the-scroll/types';

const MIN_ALPHA = 128;
// Two picked colors must differ at least this much (Euclidean RGB distance), or the palette
// would be several shades of the same color.
const MIN_COLOR_DISTANCE = 60;
const MAX_GRADIENT_OPTIONS = 4;

type Rgb = [number, number, number];

function toHex([r, g, b]: Rgb): string {
	return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

function distance(a: Rgb, b: Rgb): number {
	return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Moves a color toward black (`amount` < 0) or white (`amount` > 0); |amount| is 0..1. */
function shade(color: Rgb, amount: number): Rgb {
	const target = amount < 0 ? 0 : 255;
	const weight = Math.abs(amount);

	return color.map((channel) => channel + (target - channel) * weight) as Rgb;
}

/**
 * The most common visible colors of an RGBA pixel buffer, most frequent first, as `#rrggbb`.
 * Transparent pixels are skipped, so a cut-out avatar yields the colors of the subject and not
 * of its empty background.
 */
export function dominantColors(pixels: ArrayLike<number>, count: number): string[] {
	const buckets = new Map<number, { n: number; sum: Rgb }>();

	for (let i = 0; i + 3 < pixels.length; i += 4) {
		if (pixels[i + 3] < MIN_ALPHA) {
			continue;
		}

		const r = pixels[i];
		const g = pixels[i + 1];
		const b = pixels[i + 2];
		// 4 bits per channel: close shades share a bucket.
		const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
		const bucket = buckets.get(key) ?? { n: 0, sum: [0, 0, 0] as Rgb };

		bucket.n += 1;
		bucket.sum[0] += r;
		bucket.sum[1] += g;
		bucket.sum[2] += b;
		buckets.set(key, bucket);
	}

	const picked: Rgb[] = [];

	for (const { n, sum } of [...buckets.values()].sort((a, b) => b.n - a.n)) {
		const color = sum.map((channel) => channel / n) as Rgb;

		if (picked.every((other) => distance(other, color) >= MIN_COLOR_DISTANCE)) {
			picked.push(color);
		}

		if (picked.length === count) {
			break;
		}
	}

	return picked.map(toHex);
}

function parseHex(hex: string): Rgb {
	const value = Number.parseInt(hex.slice(1), 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * Gradient suggestions built from an avatar's dominant colors: pairs of them, or shades of the
 * only color there is. Empty when the avatar has no visible pixels.
 */
export function gradientOptions(colors: string[]): BannerGradient[] {
	if (colors.length === 0) {
		return [];
	}

	if (colors.length === 1) {
		const base = parseHex(colors[0]);

		return [
			{ from: colors[0], to: toHex(shade(base, -0.55)) },
			{ from: toHex(shade(base, 0.35)), to: colors[0] },
		];
	}

	const pairs: BannerGradient[] = [];

	for (let i = 0; i < colors.length; i++) {
		for (let j = i + 1; j < colors.length; j++) {
			pairs.push({ from: colors[i], to: colors[j] });
		}
	}

	return pairs.slice(0, MAX_GRADIENT_OPTIONS);
}

export function gradientCss(gradient: BannerGradient): string {
	return `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`;
}

/** Reads the RGBA pixels of an image downscaled to `size` x `size` (browser only). */
export async function readImagePixels(src: string, size = 48): Promise<Uint8ClampedArray> {
	const image = new Image();
	image.src = src;
	await image.decode();

	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;

	const context = canvas.getContext('2d', { willReadFrequently: true });

	if (!context) {
		return new Uint8ClampedArray();
	}

	context.drawImage(image, 0, 0, size, size);
	return context.getImageData(0, 0, size, size).data;
}
