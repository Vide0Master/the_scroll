import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { prisma as userDb } from '../../services/user-service/src/lib/prisma';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';

const postsUrl = `${API_URL}/posts`;

async function create(api: APIRequestContext, content: string) {
	const response = await api.post(postsUrl, { data: { content } });
	return (await response.json()).post as { postID: string; mentions: string[] };
}

async function postsWithTag(api: APIRequestContext, tag: string) {
	const response = await api.get(`${postsUrl}/hashtag/${encodeURIComponent(tag)}`);
	return { status: response.status(), posts: (await response.json()).posts ?? [] };
}

const ids = (posts: { postID: string }[]) => posts.map((entry) => entry.postID);

test.describe('hashtags', () => {
	// Unique per test: a tag from an aborted earlier run must not show up in this one.
	const unique = () => `t${randomUUID().slice(0, 8)}`;

	test('a post is found by its hashtag, whatever the case', async ({ userApi, guestApi }) => {
		const tag = unique();
		const post = await create(userApi, `e2e tagged #${tag.toUpperCase()} text`);

		const { status, posts } = await postsWithTag(guestApi, tag);

		expect(status).toBe(200);
		expect(ids(posts)).toEqual([post.postID]);
		expect(ids((await postsWithTag(guestApi, `#${tag.toUpperCase()}`)).posts)).toEqual([
			post.postID,
		]);
	});

	test('editing the text moves the post to its new tags', async ({ userApi, guestApi }) => {
		const [before, after] = [unique(), unique()];
		const post = await create(userApi, `e2e #${before}`);

		await userApi.patch(`${postsUrl}/${post.postID}`, { data: { content: `e2e #${after}` } });

		expect((await postsWithTag(guestApi, before)).posts).toEqual([]);
		expect(ids((await postsWithTag(guestApi, after)).posts)).toEqual([post.postID]);
	});

	test('a deleted post leaves the hashtag page', async ({ userApi, guestApi }) => {
		const tag = unique();
		const post = await create(userApi, `e2e #${tag}`);

		await userApi.delete(`${postsUrl}/${post.postID}`);

		expect((await postsWithTag(guestApi, tag)).posts).toEqual([]);
	});

	test('an unknown tag is an empty list and a malformed one is 400', async ({ guestApi }) => {
		expect(await postsWithTag(guestApi, unique())).toEqual({ status: 200, posts: [] });
		expect((await postsWithTag(guestApi, '12345')).status).toBe(400);
		expect((await postsWithTag(guestApi, 'not%20a%20tag')).status).toBe(400);
	});
});

test.describe('mentions', () => {
	test('a post lists the accounts its @names point to and ignores the rest', async ({
		userApi,
		otherAccount,
	}) => {
		const post = await create(
			userApi,
			`hi @${otherAccount.userName} and @nobody_${randomUUID().slice(0, 8)}`,
		);

		expect(post.mentions).toEqual([otherAccount.userName]);
	});

	test('mentions come back with the post in every listing and go with an edit', async ({
		userApi,
		guestApi,
		otherAccount,
	}) => {
		const post = await create(userApi, `e2e mention @${otherAccount.userName}`);

		const one = await (await guestApi.get(`${postsUrl}/${post.postID}`)).json();
		expect(one.post.mentions).toEqual([otherAccount.userName]);

		const edited = await userApi.patch(`${postsUrl}/${post.postID}`, {
			data: { content: 'e2e no mention any more' },
		});
		expect((await edited.json()).post.mentions).toEqual([]);
	});
});

test.describe('user search', () => {
	const search = (api: APIRequestContext, query: string) =>
		api.get(`${API_URL}/users/search/${encodeURIComponent(query)}`);

	test('is public, like the profiles it finds', async ({ guestApi }) => {
		expect((await search(guestApi, 'e2e')).status()).toBe(200);
	});

	test('matches the start of the username, in any case', async ({ userApi, otherAccount }) => {
		const response = await search(userApi, otherAccount.userName.slice(0, 9).toUpperCase());
		const { users } = await response.json();

		expect(response.status()).toBe(200);
		expect(users.map((entry: { userName: string }) => entry.userName)).toContain(
			otherAccount.userName,
		);
		expect(users.length).toBeLessThanOrEqual(8);
		expect(JSON.stringify(users)).not.toContain('email');
	});

	test('matches the start of the visible name too', async ({ userApi, otherAccount }) => {
		const visibleName = `Zeta ${randomUUID().slice(0, 6)}`;
		await userDb.user.update({
			where: { userID: otherAccount.userID },
			data: { visibleName },
		});

		const { users } = await (await search(userApi, visibleName.slice(0, 8))).json();

		expect(users.map((entry: { userName: string }) => entry.userName)).toContain(
			otherAccount.userName,
		);
	});

	test('a name in the middle does not match', async ({ userApi, otherAccount }) => {
		const { users } = await (await search(userApi, otherAccount.userName.slice(2, 9))).json();

		expect(users.map((entry: { userName: string }) => entry.userName)).not.toContain(
			otherAccount.userName,
		);
	});
});
