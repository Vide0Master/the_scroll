const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.ogg'];

export function isVideoUrl(url: string): boolean {
	const withoutQuery = url.split('?')[0].toLowerCase();
	return VIDEO_EXTENSIONS.some((extension) => withoutQuery.endsWith(extension));
}

// PostCard's media grid: single item full width, a pair side by side, three or more (up to
// POST_MEDIA_MAX_FILES) in rows of three.
export function mediaGridColumns(count: number): 1 | 2 | 3 {
	if (count >= 3) {
		return 3;
	}

	return count === 2 ? 2 : 1;
}

export interface FileSelection {
	accepted: File[];
	rejectedForCount: File[];
	rejectedForSize: File[];
}

// Splits a freshly picked file list into what can actually be attached: oversized files are
// dropped regardless of remaining slots, then the rest fill whatever room is left under maxFiles.
export function selectFilesWithinLimit(
	currentCount: number,
	incoming: File[],
	maxFiles: number,
	maxSizeBytes: number,
): FileSelection {
	const accepted: File[] = [];
	const rejectedForCount: File[] = [];
	const rejectedForSize: File[] = [];
	let remainingSlots = Math.max(0, maxFiles - currentCount);

	for (const file of incoming) {
		if (file.size > maxSizeBytes) {
			rejectedForSize.push(file);
			continue;
		}

		if (remainingSlots > 0) {
			accepted.push(file);
			remainingSlots -= 1;
		} else {
			rejectedForCount.push(file);
		}
	}

	return { accepted, rejectedForCount, rejectedForSize };
}
