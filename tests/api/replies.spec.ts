import type { APIRequestContext } from '@playwright/test';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';

const postsUrl = `${API_URL}/posts`;

async function post(api: APIRequestContext, content: string, parentPostID?: string) {
	const response = await api.post(postsUrl, { data: { content, parentPostID } });
	return { status: response.status(), body: await response.json() };
}

test.describe('creating replies', () => {
	test('a reply is a post that points at its parent', async ({ userApi, account }) => {
		const parent = (await post(userApi, 'e2e parent')).body.post;

		const { status, body } = await post(userApi, 'e2e reply', parent.postID);

		expect(status).toBe(201);
		expect(body.post).toMatchObject({
			content: 'e2e reply',
			authorID: account.userID,
			parentPostID: parent.postID,
			replyCount: 0,
			replyTo: { postID: parent.postID, author: { userName: account.userName } },
		});
		expect(parent.parentPostID).toBeNull();
		expect(parent.replyTo).toBeNull();
	});

	test('anyone signed in can reply to anyone, and a reply can be replied to', async ({
		userApi,
		otherAccount,
		playwright,
	}) => {
		const root = (await post(userApi, 'e2e root')).body.post;
		const other = await playwright.request.newContext();
		await other.post(`${API_URL}/auth/login`, {
			data: { loginName: otherAccount.userName, password: otherAccount.password },
		});

		const reply = (await post(other, 'e2e answer', root.postID)).body.post;
		const nested = await post(userApi, 'e2e answer to the answer', reply.postID);
		await other.dispose();

		expect(nested.status).toBe(201);
		expect(nested.body.post.replyTo.author.userName).toBe(otherAccount.userName);
	});

	test('an unknown parent is 404 and nothing is created', async ({ userApi, guestApi }) => {
		const { status, body } = await post(
			userApi,
			'e2e orphan reply',
			'00000000-0000-4000-8000-000000000000',
		);

		expect(status).toBe(404);
		expect(body.errorDetails.code).toBe('parentNotFound');
		const { posts } = await (await guestApi.get(`${postsUrl}/feed`)).json();
		expect(
			posts.some((entry: { content: string }) => entry.content === 'e2e orphan reply'),
		).toBe(false);
	});

	test('needs a session and a valid parent id', async ({ userApi, guestApi }) => {
		expect((await post(guestApi, 'e2e anon reply', 'x')).status).toBe(401);
		expect((await post(userApi, 'e2e bad parent', 'a'.repeat(65))).status).toBe(400);
	});

	test('a reply follows the same content rules as a post', async ({ userApi }) => {
		const parent = (await post(userApi, 'e2e rules parent')).body.post;

		expect((await post(userApi, '   ', parent.postID)).body.errorDetails.code).toBe(
			'emptyPost',
		);
	});

	test('editing a reply cannot re-parent it', async ({ userApi }) => {
		const first = (await post(userApi, 'e2e first')).body.post;
		const second = (await post(userApi, 'e2e second')).body.post;
		const reply = (await post(userApi, 'e2e reply', first.postID)).body.post;

		const edited = await userApi.patch(`${postsUrl}/${reply.postID}`, {
			data: { content: 'e2e edited reply', parentPostID: second.postID },
		});
		const body = await edited.json();

		expect(edited.status()).toBe(200);
		expect(body.post).toMatchObject({
			content: 'e2e edited reply',
			parentPostID: first.postID,
		});
		expect(body.post.replyTo.postID).toBe(first.postID);
	});
});

test.describe('reading threads', () => {
	test('the reply count of a post grows with every direct reply', async ({
		userApi,
		guestApi,
	}) => {
		const parent = (await post(userApi, 'e2e counted')).body.post;
		const reply = (await post(userApi, 'e2e one', parent.postID)).body.post;
		await post(userApi, 'e2e two', parent.postID);
		await post(userApi, 'e2e nested', reply.postID);

		const read = async () =>
			(await (await guestApi.get(`${postsUrl}/${parent.postID}`)).json()).post;

		// Only direct replies count, not the answer to an answer.
		expect((await read()).replyCount).toBe(2);
		await post(userApi, 'e2e three', parent.postID);
		expect((await read()).replyCount).toBe(3);
	});

	test('a post page carries the chain of ancestors, first post first', async ({
		userApi,
		guestApi,
	}) => {
		const root = (await post(userApi, 'e2e level 0')).body.post;
		const one = (await post(userApi, 'e2e level 1', root.postID)).body.post;
		const two = (await post(userApi, 'e2e level 2', one.postID)).body.post;

		const body = await (await guestApi.get(`${postsUrl}/${two.postID}`)).json();

		expect(body.ancestors.map((entry: { postID: string }) => entry.postID)).toEqual([
			root.postID,
			one.postID,
		]);
		expect(body.post.postID).toBe(two.postID);
		const rootBody = await (await guestApi.get(`${postsUrl}/${root.postID}`)).json();
		expect(rootBody.ancestors).toEqual([]);
	});

	test('replies are listed oldest first with their authors', async ({
		userApi,
		guestApi,
		account,
	}) => {
		const parent = (await post(userApi, 'e2e thread')).body.post;
		await post(userApi, 'e2e first answer', parent.postID);
		await post(userApi, 'e2e second answer', parent.postID);

		const { posts } = await (await guestApi.get(`${postsUrl}/${parent.postID}/replies`)).json();

		expect(posts.map((entry: { content: string }) => entry.content)).toEqual([
			'e2e first answer',
			'e2e second answer',
		]);
		expect(posts[0].author.userName).toBe(account.userName);
	});

	test('the feed mixes replies in and labels them', async ({ userApi, guestApi }) => {
		const parent = (await post(userApi, 'e2e feed parent')).body.post;
		const reply = (await post(userApi, 'e2e feed reply', parent.postID)).body.post;

		const { posts } = await (await guestApi.get(`${postsUrl}/feed`)).json();
		const entry = posts.find((item: { postID: string }) => item.postID === reply.postID);

		expect(entry).toMatchObject({
			parentPostID: parent.postID,
			replyTo: { postID: parent.postID },
		});
		expect(
			posts.find((item: { postID: string }) => item.postID === parent.postID).replyCount,
		).toBe(1);
	});
});

test.describe('profile listings', () => {
	test('posts lists only root posts and replies lists only replies', async ({
		userApi,
		guestApi,
		account,
	}) => {
		const parent = (await post(userApi, 'e2e profile root')).body.post;
		const reply = (await post(userApi, 'e2e profile reply', parent.postID)).body.post;
		const ids = async (kind?: string) =>
			(
				(
					await (
						await guestApi.get(
							`${postsUrl}/user/${account.userID}${kind ? `?kind=${kind}` : ''}`,
						)
					).json()
				).posts as { postID: string }[]
			).map((entry) => entry.postID);

		expect(await ids()).toContain(parent.postID);
		expect(await ids()).not.toContain(reply.postID);
		expect(await ids('replies')).toContain(reply.postID);
		expect(await ids('replies')).not.toContain(parent.postID);
	});

	test('replies carry who they answer', async ({ userApi, guestApi, account }) => {
		const parent = (await post(userApi, 'e2e context root')).body.post;
		await post(userApi, 'e2e context reply', parent.postID);

		const { posts } = await (
			await guestApi.get(`${postsUrl}/user/${account.userID}?kind=replies`)
		).json();

		expect(posts[0].replyTo).toMatchObject({
			postID: parent.postID,
			author: { userName: account.userName },
		});
	});

	test('rejects an unknown kind', async ({ guestApi, account }) => {
		const response = await guestApi.get(`${postsUrl}/user/${account.userID}?kind=likes`);

		expect(response.status()).toBe(400);
	});
});
