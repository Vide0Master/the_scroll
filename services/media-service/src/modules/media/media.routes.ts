import { FastifyPluginAsync } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { failResponse, okResponse } from '@the-scroll/backend-core';

export interface MediaRoutesOptions {
	uploadDir: string;
}

export const mediaRoutes: FastifyPluginAsync<MediaRoutesOptions> = async (fastify, options) => {
	fastify.post('/upload', async (request, reply) => {
		const data = await request.file();

		if (!data) {
			return reply
				.code(400)
				.send(failResponse('noFile', 'No file provided in multipart payload.'));
		}

		const allowedMimeTypes = [
			'image/jpeg',
			'image/png',
			'image/webp',
			'image/gif',
			'video/mp4',
		];

		if (!allowedMimeTypes.includes(data.mimetype)) {
			return reply
				.code(415)
				.send(failResponse('unsupportedType', 'Provided MIME type is not allowed.'));
		}

		const extension = path.extname(data.filename) || '.bin';
		const fileID = crypto.randomUUID();
		const storedFilename = `${fileID}${extension}`;
		const destinationPath = path.join(options.uploadDir, storedFilename);

		await pipeline(data.file, fs.createWriteStream(destinationPath));

		const fileStat = await fs.promises.stat(destinationPath);

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
