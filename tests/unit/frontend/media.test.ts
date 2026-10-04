import { expect, test } from '@playwright/test';
import {
	isVideoUrl,
	mediaGridColumns,
	selectFilesWithinLimit,
} from '../../../services/frontend-service/src/scripts/media';

function fakeFile(name: string, sizeBytes: number): File {
	return new File([new Uint8Array(Math.max(0, Math.min(sizeBytes, 1024)))], name);
}

test.describe('mediaGridColumns', () => {
	test('is 1 for a single item, 2 for a pair, 3 for three or more (up to 12)', () => {
		expect(mediaGridColumns(0)).toBe(1);
		expect(mediaGridColumns(1)).toBe(1);
		expect(mediaGridColumns(2)).toBe(2);
		expect(mediaGridColumns(3)).toBe(3);
		expect(mediaGridColumns(12)).toBe(3);
	});
});

test.describe('isVideoUrl', () => {
	test('recognizes common video extensions, case-insensitively, query string included', () => {
		expect(isVideoUrl('/api/media/file/abc.mp4')).toBe(true);
		expect(isVideoUrl('/api/media/file/ABC.MP4')).toBe(true);
		expect(isVideoUrl('/api/media/file/clip.webm?x=1')).toBe(true);
	});

	test('treats anything else as an image', () => {
		expect(isVideoUrl('/api/media/file/photo.png')).toBe(false);
		expect(isVideoUrl('/api/media/file/no-extension')).toBe(false);
		expect(isVideoUrl('')).toBe(false);
	});
});

test.describe('selectFilesWithinLimit', () => {
	const small = fakeFile('a.png', 10);

	test('accepts every file when there is room, and rejects none', () => {
		const result = selectFilesWithinLimit(0, [small, small], 12, 1000);
		expect(result.accepted).toHaveLength(2);
		expect(result.rejectedForCount).toHaveLength(0);
		expect(result.rejectedForSize).toHaveLength(0);
	});

	test('only accepts up to the remaining slots and reports the rest as rejected for count', () => {
		const result = selectFilesWithinLimit(11, [small, small, small], 12, 1000);
		expect(result.accepted).toHaveLength(1);
		expect(result.rejectedForCount).toHaveLength(2);
	});

	test('accepts nothing once the limit is already reached', () => {
		const result = selectFilesWithinLimit(12, [small], 12, 1000);
		expect(result.accepted).toHaveLength(0);
		expect(result.rejectedForCount).toHaveLength(1);
	});

	test('rejects oversized files for size, independently of the count limit', () => {
		const big = fakeFile('big.mp4', 2000);
		const result = selectFilesWithinLimit(0, [small, big], 12, 1000);
		expect(result.accepted).toEqual([small]);
		expect(result.rejectedForSize).toEqual([big]);
		expect(result.rejectedForCount).toHaveLength(0);
	});

	test('checks size before counting against the remaining slots', () => {
		const big = fakeFile('big.mp4', 2000);
		const result = selectFilesWithinLimit(11, [big, small], 12, 1000);
		// big is rejected for size, not for count, so small still gets the one remaining slot.
		expect(result.accepted).toEqual([small]);
		expect(result.rejectedForSize).toEqual([big]);
		expect(result.rejectedForCount).toHaveLength(0);
	});
});
