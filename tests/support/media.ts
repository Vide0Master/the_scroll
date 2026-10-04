import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const uploadDir = path.resolve(import.meta.dirname, '../../services/media-service/uploads');

// 1x1 transparent PNG.
export const png = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64',
);

/** Deletes files the media-service stored during a test (there is no delete endpoint). */
export async function removeUploaded(urls: string[]): Promise<void> {
	for (const url of urls) {
		await fs.rm(path.join(uploadDir, path.basename(url)), { force: true });
	}
}

const CRC_TABLE = Array.from({ length: 256 }, (_v, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) {
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	}
	return c >>> 0;
});

function crc32(data: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of data) {
		crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const out = Buffer.alloc(body.length + 8);
	out.writeUInt32BE(data.length, 0);
	body.copy(out, 4);
	out.writeUInt32BE(crc32(body), body.length + 4);
	return out;
}

/** Builds an RGBA PNG from a per-pixel function, so tests can use images with real alpha. */
export function makePng(
	width: number,
	height: number,
	pixel: (x: number, y: number) => [number, number, number, number],
): Buffer {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA

	const rows = Buffer.alloc((width * 4 + 1) * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			rows.set(pixel(x, y), y * (width * 4 + 1) + 1 + x * 4);
		}
	}

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', header),
		chunk('IDAT', zlib.deflateSync(rows)),
		chunk('IEND', Buffer.alloc(0)),
	]);
}

/** 96x96: red left half, blue right half, fully transparent corners (a "cut-out" avatar). */
export const transparentAvatar = makePng(96, 96, (x, y) => {
	const inCorner = Math.hypot(x - 47.5, y - 47.5) > 44;
	if (inCorner) {
		return [0, 0, 0, 0];
	}
	return x < 48 ? [220, 30, 30, 255] : [30, 60, 220, 255];
});
