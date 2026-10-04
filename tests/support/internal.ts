import type { APIRequestContext } from '@playwright/test';
import { SERVICE_PORTS } from './env';

const MEDIA = `http://localhost:${SERVICE_PORTS.media}`;
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN ?? '';

/* eslint-disable @typescript-eslint/naming-convention */
export const internalHeaders = { 'x-internal-token': INTERNAL_TOKEN };
/* eslint-enable @typescript-eslint/naming-convention */

export interface SweepResult {
	success: boolean;
	dryRun: boolean;
	candidates: string[];
	deleted: number;
}

/** Runs media-service's orphan sweep directly (the internal routes aren't proxied). */
export async function sweep(
	request: APIRequestContext,
	options: { ownerID: string; dryRun?: boolean; graceMs?: number },
): Promise<SweepResult> {
	const response = await request.post(`${MEDIA}/internal/media/sweep`, {
		headers: internalHeaders,
		data: { dryRun: false, graceMs: 0, ...options },
	});

	return response.json();
}

export const mediaInternalUrl = (route: string) => `${MEDIA}/internal/media/${route}`;
