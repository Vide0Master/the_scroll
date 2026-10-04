import 'dotenv/config';
import process from 'node:process';

const HOUR_MS = 60 * 60 * 1000;

const sweepMode = process.env.MEDIA_ORPHAN_SWEEP ?? 'dry-run';

if (sweepMode !== 'off' && sweepMode !== 'dry-run' && sweepMode !== 'delete') {
	throw new Error('MEDIA_ORPHAN_SWEEP must be off, dry-run or delete');
}

const graceHours = Number(process.env.MEDIA_ORPHAN_GRACE_HOURS ?? 24);

if (!Number.isFinite(graceHours) || graceHours < 0) {
	throw new Error('MEDIA_ORPHAN_GRACE_HOURS must be a non-negative number');
}

export const config = {
	// Shared secret of the service-to-service routes; without it they reject every call.
	internalToken: process.env.INTERNAL_API_TOKEN,
	sweep: {
		mode: sweepMode,
		// An upload precedes the post/profile save that claims it, so a file must stay unused
		// this long before it counts as an orphan.
		graceMs: graceHours * HOUR_MS,
		intervalMs: HOUR_MS,
	},
};
