import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import type { UserRole } from '@the-scroll/types';
import { prisma as userDb } from '../../services/user-service/src/lib/prisma';
import type { TestAccount } from './accounts';
import { API_URL } from './env';

/** A fresh API client logged in as `account` (its own cookie jar; dispose it when done). */
export async function signIn(
	playwright: PlaywrightWorkerArgs['playwright'],
	account: TestAccount,
): Promise<APIRequestContext> {
	const context = await playwright.request.newContext();
	await context.post(`${API_URL}/auth/login`, {
		data: { loginName: account.userName, password: account.password },
	});
	return context;
}

/** Sets the roles of a test account straight in the database. */
export async function setRoles(account: TestAccount, roles: UserRole[]): Promise<void> {
	await userDb.user.update({ where: { userID: account.userID }, data: { roles } });
}
