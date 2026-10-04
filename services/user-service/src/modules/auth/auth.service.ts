import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { hash, compareToHash } from '../../lib/bcrypt';
import { sendVerificationEmail } from '../../lib/mailer';
import { config } from '../../config/env';
import { MailStatus } from '../../../prisma/generated/prisma/client';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const CONFIRMED_RETENTION_MS = 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_SENDS = 5;

function hashToken(token: string) {
	return createHash('sha256').update(token).digest('hex');
}

function generateToken() {
	return randomBytes(32).toString('base64url');
}

function secondsUntilResend(lastSentAt: Date | null) {
	if (!lastSentAt) {
		return 0;
	}

	const remaining = lastSentAt.getTime() + RESEND_COOLDOWN_MS - Date.now();
	return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

async function purgeExpiredRegistrations() {
	await prisma.pendingRegistration.deleteMany({
		where: { expiresAt: { lt: new Date() } },
	});
}

export async function checkAvailability(email?: string, username?: string) {
	const result: {
		emailAvailable?: boolean;
		emailBlocked?: boolean;
		usernameAvailable?: boolean;
	} = {};

	const activePending = {
		expiresAt: { gt: new Date() },
		mailStatus: { not: MailStatus.CONFIRMED },
	};

	if (email) {
		const [user, pending, blocked] = await Promise.all([
			prisma.user.findFirst({ where: { email } }),
			prisma.pendingRegistration.findFirst({ where: { email, ...activePending } }),
			prisma.blockedEmail.findUnique({ where: { email: normalizeEmail(email) } }),
		]);
		result.emailAvailable = user === null && pending === null && blocked === null;
		result.emailBlocked = blocked !== null;
	}

	if (username) {
		const [user, pending] = await Promise.all([
			prisma.user.findFirst({ where: { userName: username } }),
			prisma.pendingRegistration.findFirst({
				where: { userName: username, ...activePending },
			}),
		]);
		result.usernameAvailable = user === null && pending === null;
	}

	return result;
}

/** Blocked emails are stored lowercased; this is the form to compare in. */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export type PendingRegistrationResult =
	| { conflict: 'email' | 'username' | 'blocked' }
	| { conflict?: undefined; id: string; token: string };

// Same email may re-register while pending, and `replacesID` lets the user drop their own
// earlier pending row after editing the data (e.g. a mistyped email).
export async function createPendingRegistration(
	email: string,
	userName: string,
	passwordPlain: string,
	replacesID?: string,
): Promise<PendingRegistrationResult> {
	await purgeExpiredRegistrations();

	const passwordHash = await hash(passwordPlain);
	const token = generateToken();

	return prisma.$transaction(async (tx) => {
		await tx.pendingRegistration.deleteMany({
			where: {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				OR: [{ email }, ...(replacesID ? [{ id: replacesID }] : [])],
				mailStatus: { not: MailStatus.CONFIRMED },
			},
		});

		if (await tx.blockedEmail.findUnique({ where: { email: normalizeEmail(email) } })) {
			return { conflict: 'blocked' as const };
		}

		if (await tx.user.findFirst({ where: { email } })) {
			return { conflict: 'email' as const };
		}

		const [userByName, pendingByName] = await Promise.all([
			tx.user.findFirst({ where: { userName } }),
			tx.pendingRegistration.findFirst({ where: { userName } }),
		]);
		if (userByName || pendingByName) {
			return { conflict: 'username' as const };
		}

		const pending = await tx.pendingRegistration.create({
			data: {
				email,
				userName,
				passwordHash,
				tokenHash: hashToken(token),
				expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
			},
		});

		return { id: pending.id, token };
	});
}

// Sends the link and records whether the mail server accepted it.
export async function dispatchVerification(id: string, email: string, token: string) {
	const url = `${config.appPublicUrl}/auth/verify?token=${encodeURIComponent(token)}`;
	const result = await sendVerificationEmail(email, url);

	await prisma.pendingRegistration.update({
		where: { id },
		data: {
			mailStatus: result.ok ? MailStatus.SENT : MailStatus.FAILED,
			mailError: result.ok ? null : (result.error ?? 'Unknown error'),
			lastSentAt: new Date(),
			sendCount: { increment: 1 },
		},
	});

	return result;
}

export type ResendResult =
	| { ok: true; status: MailStatus }
	| { ok: false; reason: 'notFound' | 'limit' }
	| { ok: false; reason: 'cooldown'; retryAfter: number };

export async function resendVerification(id: string): Promise<ResendResult> {
	const pending = await prisma.pendingRegistration.findUnique({ where: { id } });

	if (!pending || pending.expiresAt < new Date() || pending.mailStatus === MailStatus.CONFIRMED) {
		return { ok: false, reason: 'notFound' };
	}

	if (pending.sendCount >= MAX_SENDS) {
		return { ok: false, reason: 'limit' };
	}

	const retryAfter = secondsUntilResend(pending.lastSentAt);
	if (retryAfter > 0) {
		return { ok: false, reason: 'cooldown', retryAfter };
	}

	// A fresh token invalidates the link from the previous email.
	const token = generateToken();
	await prisma.pendingRegistration.update({
		where: { id },
		data: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
	});

	const result = await dispatchVerification(id, pending.email, token);
	return { ok: true, status: result.ok ? MailStatus.SENT : MailStatus.FAILED };
}

export async function getRegistrationStatus(id: string) {
	const pending = await prisma.pendingRegistration.findUnique({ where: { id } });

	if (!pending || pending.expiresAt < new Date()) {
		return null;
	}

	return {
		status: pending.mailStatus,
		retryAfter: secondsUntilResend(pending.lastSentAt),
		error: pending.mailError ?? undefined,
	};
}

// Returns null for an unknown, used or expired token.
export async function confirmRegistration(token: string) {
	return prisma.$transaction(async (tx) => {
		const pending = await tx.pendingRegistration.findUnique({
			where: { tokenHash: hashToken(token) },
		});

		if (
			!pending ||
			pending.expiresAt < new Date() ||
			pending.mailStatus === MailStatus.CONFIRMED
		) {
			return null;
		}

		// Blocked after the form was sent: the link must not create the account.
		if (await tx.blockedEmail.findUnique({ where: { email: normalizeEmail(pending.email) } })) {
			await tx.pendingRegistration.delete({ where: { id: pending.id } });
			return null;
		}

		const user = await tx.user.create({
			data: {
				email: pending.email,
				userName: pending.userName,
				password: pending.passwordHash,
			},
		});

		// Keep the row briefly so the waiting registration tab can see CONFIRMED,
		// but drop the password hash and kill the token.
		await tx.pendingRegistration.update({
			where: { id: pending.id },
			data: {
				mailStatus: MailStatus.CONFIRMED,
				passwordHash: '',
				tokenHash: generateToken(),
				expiresAt: new Date(Date.now() + CONFIRMED_RETENTION_MS),
			},
		});

		return user;
	});
}

export async function authenticateUser(loginName: string, passwordPlain: string) {
	const user = await prisma.user.findFirst({
		where: {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			OR: [{ userName: loginName }, { email: loginName }],
		},
	});

	if (!user) {
		return null;
	}

	const isPasswordValid = await compareToHash(passwordPlain, user.password);
	if (!isPasswordValid) {
		return null;
	}

	return user;
}

export async function createSession(userID: string) {
	return prisma.session.create({
		data: { userID },
	});
}
