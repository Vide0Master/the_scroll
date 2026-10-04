import type { APIRequestContext } from '@playwright/test';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';
import { signIn } from '../support/session';

const followUrl = (userName: string) => `${API_URL}/users/${userName}/follow`;
const statsUrl = (userName: string) => `${API_URL}/users/${userName}/follow-stats`;

async function stats(api: APIRequestContext, userName: string) {
	return (await (await api.get(statsUrl(userName))).json()).stats;
}

test.describe('following', () => {
	test('following counts on both sides, and unfollowing takes it back', async ({
		userApi,
		guestApi,
		account,
		otherAccount,
	}) => {
		expect((await userApi.put(followUrl(otherAccount.userName))).status()).toBe(200);

		expect(await stats(userApi, otherAccount.userName)).toEqual({
			followerCount: 1,
			followingCount: 0,
			isFollowing: true,
		});
		expect(await stats(userApi, account.userName)).toMatchObject({
			followerCount: 0,
			followingCount: 1,
		});
		// A guest sees the numbers, but never "you follow".
		expect((await stats(guestApi, otherAccount.userName)).isFollowing).toBe(false);

		expect((await userApi.delete(followUrl(otherAccount.userName))).status()).toBe(200);
		expect(await stats(userApi, otherAccount.userName)).toMatchObject({
			followerCount: 0,
			isFollowing: false,
		});
	});

	test('following twice is harmless', async ({ userApi, otherAccount }) => {
		await userApi.put(followUrl(otherAccount.userName));
		expect((await userApi.put(followUrl(otherAccount.userName))).status()).toBe(200);

		expect((await stats(userApi, otherAccount.userName)).followerCount).toBe(1);

		await userApi.delete(followUrl(otherAccount.userName));
	});

	test('you cannot follow yourself, nobody unknown, and a guest cannot follow at all', async ({
		userApi,
		guestApi,
		account,
		otherAccount,
	}) => {
		expect((await userApi.put(followUrl(account.userName))).status()).toBe(400);
		expect((await userApi.put(followUrl('no_such_user_e2e'))).status()).toBe(404);
		expect((await guestApi.put(followUrl(otherAccount.userName))).status()).toBe(401);
		expect((await guestApi.get(statsUrl('no_such_user_e2e'))).status()).toBe(404);
	});

	test('the following feed holds only posts of followed accounts', async ({
		userApi,
		guestApi,
		otherAccount,
		playwright,
	}) => {
		const other = await signIn(playwright, otherAccount);
		await other.post(`${API_URL}/posts`, { data: { content: 'e2e from someone I follow' } });
		await other.dispose();
		await userApi.post(`${API_URL}/posts`, { data: { content: 'e2e my own post' } });

		const before = (await (await userApi.get(`${API_URL}/posts/feed?scope=following`)).json())
			.posts;
		await userApi.put(followUrl(otherAccount.userName));
		const after = (await (await userApi.get(`${API_URL}/posts/feed?scope=following`)).json())
			.posts;
		await userApi.delete(followUrl(otherAccount.userName));

		expect(before.map((entry: { content: string }) => entry.content)).not.toContain(
			'e2e from someone I follow',
		);
		expect(after.map((entry: { content: string }) => entry.content)).toEqual([
			'e2e from someone I follow',
		]);
		expect((await guestApi.get(`${API_URL}/posts/feed?scope=following`)).status()).toBe(401);
	});
});
