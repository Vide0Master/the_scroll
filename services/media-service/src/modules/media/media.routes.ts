import { FastifyPluginAsync } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { failResponse, okResponse } from '@the-scroll/backend-core';
import { ALLOWED_MIME_TYPES, extensionForMime } from '../../lib/storedName';
import { registerUpload } from './media.service';

export interface MediaRoutesOptions {
	uploadDir: string;
}

export const mediaRoutes: FastifyPluginAsync<MediaRoutesOptions> = async (fastify, options) => {
	fastify.post('/upload', { preHandler: [fastify.authenticate] }, async (request, reply) => {
		const data = await request.file();

		if (!data) {
			return reply
				.code(400)
				.send(failResponse('noFile', 'No file provided in multipart payload.'));
		}

		const extension = extensionForMime(data.mimetype);

		if (!extension || !ALLOWED_MIME_TYPES.includes(data.mimetype)) {
			return reply
				.code(415)
				.send(failResponse('unsupportedType', 'Provided MIME type is not allowed.'));
		}

		// The extension follows the checked MIME type; the client's file name is never used.
		const fileID = crypto.randomUUID();
		const storedFilename = `${fileID}.${extension}`;
		const destinationPath = path.join(options.uploadDir, storedFilename);

		await pipeline(data.file, fs.createWriteStream(destinationPath));

		// @fastify/multipart truncates a stream that exceeds `limits.fileSize` instead of
		// throwing; the truncated file has already been written to disk at this point, so it
		// must be removed and the request rejected explicitly.
		if (data.file.truncated) {
			await fs.promises.unlink(destinationPath).catch(() => undefined);

			return reply
				.code(413)
				.send(failResponse('fileTooLarge', 'File exceeds the maximum upload size.'));
		}

		const fileStat = await fs.promises.stat(destinationPath);

		try {
			await registerUpload({
				fileID,
				storedName: storedFilename,
				ownerID: request.userID!,
				mimeType: data.mimetype,
				size: fileStat.size,
			});
		} catch (error) {
			// An untracked file would be invisible to the sweeper; don't leave one behind.
			await fs.promises.unlink(destinationPath).catch(() => undefined);
			throw error;
		}

		return reply.code(201).send(
			okResponse({
				file: {
					id: fileID,
					url: `/api/media/file/${storedFilename}`,
					originalName: data.filename,
					mimeType: data.mimetype,
					size: fileStat.size,
				},
			}),
		);
	});
};
