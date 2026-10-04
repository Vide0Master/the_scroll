import { z } from 'zod';

export const registerSchema = z.object({
	email: z.email(),
	username: z.string().trim().min(3).max(32),
	password: z.string().min(8).max(128),
	replacesID: z.uuid().optional(),
});

export const pendingIdSchema = z.object({ id: z.uuid() });

export const verifySchema = z.object({ token: z.string().min(16).max(128) });
