import type { FastifyBaseLogger } from 'fastify';
import { config } from '../config/env';
import { sweepOrphans } from '../modules/media/media.service';

/**
 * Runs the orphan sweep once at startup and then every hour, per `MEDIA_ORPHAN_SWEEP`:
 * `off` does nothing, `dry-run` (the default) only logs what it would delete, `delete` deletes.
 * One instance is assumed; with several, add a lock (e.g. Redis `SET NX`) before enabling `delete`.
 */
export function startOrphanSweeper(log: FastifyBaseLogger, uploadDir: string): void {
	if (config.sweep.mode === 'off') {
		log.info('Orphan sweep is off');
		return;
	}

	const run = async () => {
		try {
			const result = await sweepOrphans(uploadDir, {
				dryRun: config.sweep.mode === 'dry-run',
				graceMs: config.sweep.graceMs,
			});

			log.info(
				{
					dryRun: result.dryRun,
					imported: result.imported,
					candidates: result.candidates.length,
					deleted: result.deleted,
				},
				result.dryRun ? 'Orphan sweep (dry run)' : 'Orphan sweep',
			);
		} catch (error) {
			log.error(error, 'Orphan sweep failed');
		}
	};

	void run();
	setInterval(run, config.sweep.intervalMs).unref();
}
