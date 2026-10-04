import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';

test.describe('public user lookup', () => {
	test('finds a user by name, with or without the @', async ({ guestApi, account }) => {
		for (const name of [account.userName, `@${account.userName}`]) {
			const response = await guestApi.get(`${API_URL}/users/${encodeURIComponent(name)}`);
			const body = await response.json();

			expect(response.status()).toBe(200);
			expect(body.userData.userID).toBe(account.userID);
			expect(JSON.stringify(body)).not.toContain('password');
		}
	});

	test('answers 404 for an unknown name', async ({ guestApi }) => {
		const response = await guestApi.get(`${API_URL}/users/e2e_no_such_user`);

		expect(response.status()).toBe(404);
	});

	test('resolves several ids at once and ignores unknown ones', async ({ guestApi, account }) => {
		const response = await guestApi.post(`${API_URL}/users/by-ids`, {
			data: { userIDs: [account.userID, '00000000-0000-4000-8000-000000000000'] },
		});
		const { users } = await response.json();

		expect(users).toHaveLength(1);
		expect(users[0]).toMatchObject({ userID: account.userID, userName: account.userName });
	});
});
