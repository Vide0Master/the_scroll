import type { APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { prisma as userDb } from '../../services/user-service/src/lib/prisma';
import { createAccount, deleteAccount, type TestAccount } from '../support/accounts';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';
import { setRoles, signIn } from '../support/session';

const postsUrl = `${API_URL}/posts`;
const banUrl = (userName: string) => `${API_URL}/users/admin/users/${userName}/ban`;

async function create(api: APIRequestContext, content: string) {
	const response = await api.post(postsUrl, { data: { content } });
	return (await response.json()).post as { postID: string };
}

// `account` lives as long as the worker: roles given to it must not leak into other tests.
test.afterEach(async ({ account }) => {
	await setRoles(account, []);
});

test.describe('removing posts as a moderator', () => {
	test('a moderator removes someone else’s post: it stays as a placeholder, unattributed', async ({
		playwright,
		account,
		otherAccount,
		guestApi,
	}) => {
		const author = await signIn(playwright, otherAccount);
		const post = await create(author, 'e2e to be removed');
		await setRoles(account, ['MODERATOR']);
		const moderator = await signIn(playwright, account);

		const response = await moderator.delete(`${postsUrl}/${post.postID}/moderation`, {
			data: { reason: 'spam' },
		});
		const shown = (await (await guestApi.get(`${postsUrl}/${post.postID}`)).json()).post;
		const feed = (await (await guestApi.get(`${postsUrl}/feed`)).json()).posts;
		const again = await moderator.delete(`${postsUrl}/${post.postID}/moderation`);
		const authorDeletes = await author.delete(`${postsUrl}/${post.postID}`);
		await Promise.all([author.dispose(), moderator.dispose()]);

		expect(response.status()).toBe(200);
		expect(shown).toMatchObject({
			isDeleted: true,
			removedByModerator: true,
			content: '',
			authorID: '',
			author: null,
		});
		// The reason is for the record only.
		expect(JSON.stringify(shown)).not.toContain('spam');
		expect(feed.some((entry: { postID: string }) => entry.postID === post.postID)).toBe(false);
		expect(again.status()).toBe(404);
		expect(authorDeletes.status()).toBe(404);
	});

	test('a regular user and a guest cannot use it, and the post stays', async ({
		userApi,
		guestApi,
		otherAccount,
		playwright,
	}) => {
		const author = await signIn(playwright, otherAccount);
		const post = await create(author, 'e2e untouched');
		await author.dispose();

		expect((await userApi.delete(`${postsUrl}/${post.postID}/moderation`)).status()).toBe(403);
		expect((await guestApi.delete(`${postsUrl}/${post.postID}/moderation`)).status()).toBe(401);
		expect((await userApi.get(`${postsUrl}/moderation/list`)).status()).toBe(403);
		expect((await guestApi.get(`${postsUrl}/moderation/list`)).status()).toBe(401);

		const shown = (await (await guestApi.get(`${postsUrl}/${post.postID}`)).json()).post;
		expect(shown).toMatchObject({ content: 'e2e untouched', isDeleted: false });
	});

	test('the moderation list shows removed posts too', async ({
		playwright,
		account,
		userApi,
	}) => {
		const post = await create(userApi, 'e2e listed');
		await setRoles(account, ['ADMIN']);
		const admin = await signIn(playwright, account);
		await admin.delete(`${postsUrl}/${post.postID}/moderation`);

		const { posts } = await (await admin.get(`${postsUrl}/moderation/list`)).json();
		await admin.dispose();

		expect(
			posts.find((entry: { postID: string }) => entry.postID === post.postID),
		).toMatchObject({ isDeleted: true, removedByModerator: true });
	});
});

test.describe('blocking accounts', () => {
	let target: TestAccount;

	test.beforeEach(async () => {
		target = await createAccount();
	});

	test.afterEach(async () => {
		await userDb.blockedEmail.deleteMany({ where: { email: target.email.toLowerCase() } });
		await deleteAccount(target);
	});

	test('a blocked account is logged out at once, cannot log in or post, and its email cannot register', async ({
		playwright,
		account,
		guestApi,
	}) => {
		const targetSession = await signIn(playwright, target);
		expect((await targetSession.get(`${API_URL}/users/me`)).status()).toBe(200);
		await setRoles(account, ['MODERATOR']);
		const moderator = await signIn(playwright, account);

		const ban = await moderator.post(banUrl(target.userName), { data: { reason: 'abuse' } });

		expect(ban.status()).toBe(200);
		// The session it already had is gone everywhere, posting included.
		expect((await targetSession.get(`${API_URL}/users/me`)).status()).toBe(401);
		expect((await targetSession.post(postsUrl, { data: { content: 'e2e x' } })).status()).toBe(
			401,
		);
		await targetSession.dispose();

		const login = await guestApi.post(`${API_URL}/auth/login`, {
			data: { loginName: target.userName, password: target.password },
		});
		expect(login.status()).toBe(403);
		expect((await login.json()).errorDetails.code).toBe('accountBanned');

		// A wrong password still looks like any wrong password: banned names are not probed.
		const wrong = await guestApi.post(`${API_URL}/auth/login`, {
			data: { loginName: target.userName, password: 'wrong-password-1' },
		});
		expect((await wrong.json()).errorDetails.code).toBe('loginPasswordError');

		const profile = await (await guestApi.get(`${API_URL}/users/${target.userName}`)).json();
		expect(profile.userData.isBanned).toBe(true);

		const check = await (
			await guestApi.post(`${API_URL}/auth/check`, { data: { email: target.email } })
		).json();
		expect(check).toMatchObject({ emailAvailable: false, emailBlocked: true });

		// Another name does not help: the email is what is blocked, in any letter case.
		const register = await guestApi.post(`${API_URL}/auth/register`, {
			data: {
				email: target.email.toUpperCase(),
				username: `e2e_${randomUUID().slice(0, 8)}`,
				password: 'a-long-enough-password',
			},
		});
		expect(register.status()).toBe(403);
		expect((await register.json()).errorDetails.code).toBe('emailBlocked');
		await moderator.dispose();
	});

	test('unblocking lets the account in again and frees the email', async ({
		playwright,
		account,
		guestApi,
	}) => {
		await setRoles(account, ['MODERATOR']);
		const moderator = await signIn(playwright, account);
		await moderator.post(banUrl(target.userName));

		const unban = await moderator.delete(banUrl(target.userName));
		const again = await moderator.delete(banUrl(target.userName));
		await moderator.dispose();

		expect(unban.status()).toBe(200);
		expect(again.status()).toBe(409);

		const login = await guestApi.post(`${API_URL}/auth/login`, {
			data: { loginName: target.userName, password: target.password },
		});
		expect(login.status()).toBe(200);

		const check = await (
			await guestApi.post(`${API_URL}/auth/check`, { data: { email: target.email } })
		).json();
		expect(check.emailBlocked).toBe(false);
	});

	test('who may block whom', async ({ playwright, account, otherAccount, guestApi, userApi }) => {
		// A regular user and a guest: never.
		expect((await userApi.post(banUrl(target.userName))).status()).toBe(403);
		expect((await guestApi.post(banUrl(target.userName))).status()).toBe(401);

		// A moderator: not a moderator, not an admin, not themselves.
		await setRoles(account, ['MODERATOR']);
		await setRoles(otherAccount, ['MODERATOR']);
		await setRoles(target, ['ADMIN']);
		const moderator = await signIn(playwright, account);
		expect((await moderator.post(banUrl(otherAccount.userName))).status()).toBe(403);
		expect((await moderator.post(banUrl(target.userName))).status()).toBe(403);
		expect((await moderator.post(banUrl(account.userName))).status()).toBe(403);
		expect((await moderator.post(banUrl('no_such_user_e2e'))).status()).toBe(404);
		await moderator.dispose();

		// An admin: a moderator yes, another admin no.
		await setRoles(account, ['ADMIN']);
		const admin = await signIn(playwright, account);
		expect((await admin.post(banUrl(otherAccount.userName))).status()).toBe(200);
		expect((await admin.post(banUrl(target.userName))).status()).toBe(403);
		await admin.delete(banUrl(otherAccount.userName));
		await admin.dispose();
	});

	test('the list finds accounts; emails are for admins only', async ({ playwright, account }) => {
		await setRoles(account, ['MODERATOR']);
		const moderator = await signIn(playwright, account);
		await moderator.post(banUrl(target.userName));

		const found = (
			await (
				await moderator.get(`${API_URL}/users/admin/users?query=${target.userName}`)
			).json()
		).users;
		const banned = (
			await (await moderator.get(`${API_URL}/users/admin/users?banned=true`)).json()
		).users;
		const byEmail = (
			await (await moderator.get(`${API_URL}/users/admin/users?query=${target.email}`)).json()
		).users;

		expect(found).toHaveLength(1);
		expect(found[0]).toMatchObject({
			userName: target.userName,
			isBanned: true,
			banReason: null,
		});
		expect(found[0].email).toBeUndefined();
		expect(banned.map((entry: { userName: string }) => entry.userName)).toContain(
			target.userName,
		);
		// A moderator cannot search by email either.
		expect(byEmail).toEqual([]);
		await moderator.dispose();

		await setRoles(account, ['ADMIN']);
		const admin = await signIn(playwright, account);
		const adminView = (
			await (await admin.get(`${API_URL}/users/admin/users?query=${target.email}`)).json()
		).users;
		await admin.dispose();

		expect(adminView).toHaveLength(1);
		expect(adminView[0].email).toBe(target.email);
	});
});
