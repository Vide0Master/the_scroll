import type { MediaUsageRequest } from '@the-scroll/types';
import { INTERNAL_TOKEN_HEADER } from './internalAuth';

/** `code` is media-service's error code (e.g. `mediaNotOwned`) or `mediaUnavailable`. */
export class MediaUsageError extends Error {
	constructor(
		public readonly code: string,
		message: string,
	) {
		super(message);
		this.name = 'MediaUsageError';
	}
}

export interface MediaUsageClient {
	/**
	 * Tells media-service which files the given entities use now. Throws `MediaUsageError` when it
	 * refuses or can't be reached; callers run it inside the database transaction of the write, so
	 * a failure rolls the write back instead of leaving a file that media-service would sweep.
	 */
	sync(request: MediaUsageRequest): Promise<void>;
}

export function createMediaUsageClient(options: {
	url: string | undefined;
	token: string | undefined;
	timeoutMs?: number;
}): MediaUsageClient {
	return {
		async sync(request) {
			if (!options.url || !options.token) {
				throw new MediaUsageError('mediaUnavailable', 'Media service is not configured.');
			}

			let response: Response;

			try {
				response = await fetch(`${options.url}/internal/media/usage`, {
					method: 'PUT',
					headers: {
						// eslint-disable-next-line @typescript-eslint/naming-convention
						'Content-Type': 'application/json',
						[INTERNAL_TOKEN_HEADER]: options.token,
					},
					body: JSON.stringify(request),
					signal: AbortSignal.timeout(options.timeoutMs ?? 3000),
				});
			} catch {
				throw new MediaUsageError(
					'mediaUnavailable',
					'Media service could not be reached.',
				);
			}

			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as {
					errorDetails?: { code?: string; description?: string };
				} | null;

				throw new MediaUsageError(
					body?.errorDetails?.code ?? 'mediaUnavailable',
					body?.errorDetails?.description ?? `Media service answered ${response.status}.`,
				);
			}
		},
	};
}
