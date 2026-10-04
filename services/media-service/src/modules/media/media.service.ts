import fs from 'node:fs/promises';
import path from 'node:path';
import type { MediaUsageSet } from '@the-scroll/types';
import { prisma } from '../../lib/prisma';
import { isStoredName, mimeForExtension, storedNameFromUrl } from '../../lib/storedName';

export class MediaNotOwnedError extends Error {
	constructor(public readonly storedName: string) {
		super(`File ${storedName} was uploaded by someone else`);
	}
}

export interface UploadRecord {
	fileID: string;
	storedName: string;
	ownerID: string;
	mimeType: string;
	size: number;
}

export function registerUpload(record: UploadRecord) {
	return prisma.mediaFile.create({ data: record });
}

/**
 * Makes each `usages` entry list exactly the given files: adds usages for files that are new to
 * the entity and removes the rest. A file that gains a user stops being unused; one that loses
 * its last user starts its grace period. URLs that aren't ours or aren't tracked are ignored
 * (there is nothing to delete for them). All-or-nothing, one transaction.
 */
export async function syncUsages(ownerID: string, usages: MediaUsageSet[]) {
	return prisma.$transaction(async (tx) => {
		for (const { kind, refID, urls } of usages) {
			const names = [...new Set(urls.map(storedNameFromUrl).filter((name) => name !== null))];
			const files = names.length
				? await tx.mediaFile.findMany({ where: { storedName: { in: names } } })
				: [];

			// A file with an owner can only be attached by that owner; legacy files have none.
			const foreign = files.find((file) => file.ownerID !== null && file.ownerID !== ownerID);

			if (foreign) {
				throw new MediaNotOwnedError(foreign.storedName);
			}

			const wanted = new Set(files.map((file) => file.fileID));
			const current = new Set(
				(
					await tx.mediaUsage.findMany({
						where: { kind, refID },
						select: { fileID: true },
					})
				).map((usage) => usage.fileID),
			);
			const added = [...wanted].filter((id) => !current.has(id));
			const removed = [...current].filter((id) => !wanted.has(id));

			if (added.length > 0) {
				await tx.mediaUsage.createMany({
					data: added.map((fileID) => ({ fileID, kind, refID })),
					skipDuplicates: true,
				});
				await tx.mediaFile.updateMany({
					where: { fileID: { in: added } },
					data: { unusedSince: null },
				});
			}

			if (removed.length > 0) {
				await tx.mediaUsage.deleteMany({ where: { kind, refID, fileID: { in: removed } } });

				const stillUsed = new Set(
					(
						await tx.mediaUsage.findMany({
							where: { fileID: { in: removed } },
							select: { fileID: true },
						})
					).map((usage) => usage.fileID),
				);
				const nowUnused = removed.filter((id) => !stillUsed.has(id));

				if (nowUnused.length > 0) {
					await tx.mediaFile.updateMany({
						where: { fileID: { in: nowUnused } },
						data: { unusedSince: new Date() },
					});
				}
			}
		}
	});
}

/**
 * Records files that exist in `uploadDir` but not in the database as legacy: they predate
 * tracking (or a crash lost their row), nobody can say what uses them, so they are protected
 * from the sweeper instead of guessed at.
 */
export async function importUntrackedFiles(uploadDir: string): Promise<number> {
	const names = (await fs.readdir(uploadDir)).filter(isStoredName);
	const known = new Set(
		(
			await prisma.mediaFile.findMany({
				where: { storedName: { in: names } },
				select: { storedName: true },
			})
		).map((file) => file.storedName),
	);
	let imported = 0;

	for (const storedName of names.filter((name) => !known.has(name))) {
		const stat = await fs.stat(path.join(uploadDir, storedName));

		await prisma.mediaFile.create({
			data: {
				fileID: storedName.slice(0, storedName.lastIndexOf('.')),
				storedName,
				mimeType: mimeForExtension(storedName),
				size: stat.size,
				isLegacy: true,
				unusedSince: null,
			},
		});
		imported++;
	}

	return imported;
}

export interface SweepOptions {
	dryRun: boolean;
	/** How long a file must have been unused to count as an orphan. */
	graceMs: number;
	/** Only this uploader's files (used by tests to stay clear of everyone else's uploads). */
	ownerID?: string;
}

export interface SweepResult {
	dryRun: boolean;
	imported: number;
	candidates: string[];
	deleted: number;
}

/** Deletes tracked files that nothing has used for longer than the grace period. */
export async function sweepOrphans(uploadDir: string, options: SweepOptions): Promise<SweepResult> {
	const imported = await importUntrackedFiles(uploadDir);
	const cutoff = new Date(Date.now() - options.graceMs);
	const candidates = await prisma.mediaFile.findMany({
		where: {
			isLegacy: false,
			unusedSince: { not: null, lt: cutoff },
			usages: { none: {} },
			...(options.ownerID ? { ownerID: options.ownerID } : {}),
		},
		select: { fileID: true, storedName: true },
	});
	let deleted = 0;

	if (!options.dryRun) {
		for (const { fileID, storedName } of candidates) {
			// Claim the row first, re-checking that nothing attached the file since the query:
			// only the caller that removed the row goes on to delete the bytes.
			const claimed = await prisma.mediaFile.deleteMany({
				where: { fileID, usages: { none: {} } },
			});

			if (claimed.count === 0) {
				continue;
			}

			await fs.rm(path.join(uploadDir, storedName), { force: true });
			deleted++;
		}
	}

	return {
		dryRun: options.dryRun,
		imported,
		candidates: candidates.map((file) => file.storedName),
		deleted,
	};
}
