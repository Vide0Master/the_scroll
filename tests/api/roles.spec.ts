import { prisma as userDb } from '../../services/user-service/src/lib/prisma';
import { API_URL } from '../support/env';
import { createAccount, deleteAccount } from '../support/accounts';
import { signIn } from '../support/session';
import { expect, test } from '../support/fixtures';

const rolesUrl = (userName: string) => `${API_URL}/users/${userName}/roles`;

test.describe('roles', () => {
	// `account` lives as long as the worker, so roles given to it must not leak into other tests.
	test.afterEach(async ({ account }) => {
		await userDb.user.update({ where: { userID: account.userID }, data: { roles: [] } });
	});

	test('a new account has no roles, publicly and in its own session', async ({
		userApi,
		guestApi,
		account,
	}) => {
		const own = await (await userApi.get(`${API_URL}/users/me`)).json();
		const shown = await (await guestApi.get(`${API_URL}/users/${account.userName}`)).json();

		expect(own.userData.roles).toEqual([]);
		expect(shown.userData.roles).toEqual([]);
	});

	test('an admin sets the roles of another account and everyone sees them', async ({
		playwright,
		guestApi,
		account,
		otherAccount,
	}) => {
		await userDb.user.update({ where: { userID: account.userID }, data: { roles: ['ADMIN'] } });
		const admin = await signIn(playwright, account);

		const response = await admin.put(rolesUrl(otherAccount.userName), {
			// Duplicates collapse into a set.
			data: { roles: ['MODERATOR', 'ADMIN', 'MODERATOR'] },
		});
		const status = response.status();
		const updated = (await response.json()).userData.roles.sort();
		await admin.dispose();

		expect(status).toBe(200);
		expect(updated).toEqual(['ADMIN', 'MODERATOR']);

		const shown = await (
			await guestApi.get(`${API_URL}/users/${otherAccount.userName}`)
		).json();
		expect(shown.userData.roles.sort()).toEqual(['ADMIN', 'MODERATOR']);
	});

	test('a regular user, a moderator and a guest cannot change roles', async ({
		playwright,
		guestApi,
		account,
		otherAccount,
	}) => {
		const target = await createAccount();

		try {
			const asUser = await signIn(playwright, otherAccount);
			await userDb.user.update({
				where: { userID: account.userID },
				data: { roles: ['MODERATOR'] },
			});
			const asModerator = await signIn(playwright, account);
			const body = { data: { roles: ['ADMIN'] } };

			expect((await asUser.put(rolesUrl(target.userName), body)).status()).toBe(403);
			expect((await asModerator.put(rolesUrl(target.userName), body)).status()).toBe(403);
			expect((await guestApi.put(rolesUrl(target.userName), body)).status()).toBe(401);
			await Promise.all([asUser.dispose(), asModerator.dispose()]);

			const shown = await (await guestApi.get(`${API_URL}/users/${target.userName}`)).json();
			expect(shown.userData.roles).toEqual([]);
		} finally {
			await deleteAccount(target);
		}
	});

	test('an admin cannot change their own roles, and bad input is rejected', async ({
		playwright,
		account,
		otherAccount,
	}) => {
		await userDb.user.update({ where: { userID: account.userID }, data: { roles: ['ADMIN'] } });
		const admin = await signIn(playwright, account);

		const own = await admin.put(rolesUrl(account.userName), { data: { roles: [] } });
		const unknownRole = await admin.put(rolesUrl(otherAccount.userName), {
			data: { roles: ['OWNER'] },
		});
		const extraField = await admin.put(rolesUrl(otherAccount.userName), {
			data: { roles: [], userID: 'x' },
		});
		const nobody = await admin.put(rolesUrl('no_such_user_e2e'), { data: { roles: [] } });
		const ownCode = (await own.json()).errorDetails.code;
		await admin.dispose();

		expect(own.status()).toBe(403);
		expect(ownCode).toBe('ownRoles');
		expect(unknownRole.status()).toBe(400);
		expect(extraField.status()).toBe(400);
		expect(nobody.status()).toBe(404);
	});
});
