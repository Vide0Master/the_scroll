import { FastifyPluginAsync } from 'fastify';
import { failResponse, okResponse, requireInternalToken } from '@the-scroll/backend-core';
import type { MediaUsageKind, MediaUsageRequest } from '@the-scroll/types';
import { config } from '../../config/env';
import { MediaNotOwnedError, sweepOrphans, syncUsages } from '../media/media.service';

const USAGE_KINDS: MediaUsageKind[] = ['post', 'avatar', 'banner'];
const MAX_USAGE_SETS = 10;
const MAX_URLS_PER_SET = 100;
const MAX_URL_LENGTH = 2048;
const MAX_ID_LENGTH = 64;

function isId(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

// Internal callers are trusted services, but they relay user input, so the shape is still checked.
function parseUsageRequest(body: unknown): MediaUsageRequest | null {
	const request = body as Partial<MediaUsageRequest> | null;

	if (!request || !isId(request.ownerID) || !Array.isArray(request.usages)) {
		return null;
	}

	if (request.usages.length === 0 || request.usages.length > MAX_USAGE_SETS) {
		return null;
	}

	for (const set of request.usages) {
		if (
			!set ||
			!USAGE_KINDS.includes(set.kind) ||
			!isId(set.refID) ||
			!Array.isArray(set.urls) ||
			set.urls.length > MAX_URLS_PER_SET ||
			!set.urls.every((url) => typeof url === 'string' && url.length <= MAX_URL_LENGTH)
		) {
			return null;
		}
	}

	return request as MediaUsageRequest;
}

export interface InternalRoutesOptions {
	uploadDir: string;
}

/** Service-to-service routes. Mounted at `/internal`, which no public proxy path reaches. */
export const internalRoutes: FastifyPluginAsync<InternalRoutesOptions> = async (
	fastify,
	options,
) => {
	fastify.addHook('preHandler', requireInternalToken(config.internalToken));

	fastify.put('/media/usage', async (request, reply) => {
		const usageRequest = parseUsageRequest(request.body);

		if (!usageRequest) {
			return reply
				.code(400)
				.send(failResponse('invalidUsage', 'Usage request is missing or invalid.'));
		}

		try {
			await syncUsages(usageRequest.ownerID, usageRequest.usages);
		} catch (error) {
			if (error instanceof MediaNotOwnedError) {
				return reply
					.code(403)
					.send(failResponse('mediaNotOwned', 'A file was uploaded by another user.'));
			}

			throw error;
		}

		return reply.code(200).send(okResponse());
	});

	fastify.post('/media/sweep', async (request, reply) => {
		const body = (request.body ?? {}) as {
			dryRun?: unknown;
			graceMs?: unknown;
			ownerID?: unknown;
		};
		const graceMs = body.graceMs === undefined ? config.sweep.graceMs : Number(body.graceMs);

		if (!Number.isFinite(graceMs) || graceMs < 0) {
			return reply.code(400).send(failResponse('invalidSweep', 'graceMs must be >= 0.'));
		}

		const result = await sweepOrphans(options.uploadDir, {
			dryRun: body.dryRun !== false,
			graceMs,
			ownerID: isId(body.ownerID) ? body.ownerID : undefined,
		});

		return reply.code(200).send(okResponse(result));
	});
};
