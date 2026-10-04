import type { APIRequestContext } from '@playwright/test';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';

const postsUrl = `${API_URL}/posts`;

async function create(api: APIRequestContext, content: string, parentPostID?: string) {
	const response = await api.post(postsUrl, { data: { content, parentPostID } });
	return (await response.json()).post as { postID: string };
}

test.describe('deleting posts', () => {
	test('the author deletes a post: it is kept, marked deleted and emptied', async ({
		userApi,
		guestApi,
	}) => {
		const post = await create(userApi, 'e2e to be deleted');

		const response = await userApi.delete(`${postsUrl}/${post.postID}`);
		expect(response.status()).toBe(200);

		const { post: shown } = await (await guestApi.get(`${postsUrl}/${post.postID}`)).json();
		expect(shown).toMatchObject({
			postID: post.postID,
			isDeleted: true,
			content: '',
			media: [],
		});
	});

	test('a deleted post does not disclose its author, nor does a reply to it', async ({
		userApi,
		guestApi,
	}) => {
		const parent = await create(userApi, 'e2e anonymous parent');
		const reply = await create(userApi, 'e2e reply to anonymous', parent.postID);
		await userApi.delete(`${postsUrl}/${parent.postID}`);

		const { post } = await (await guestApi.get(`${postsUrl}/${parent.postID}`)).json();
		expect(post).toMatchObject({ isDeleted: true, authorID: '', author: null });

		const thread = await (await guestApi.get(`${postsUrl}/${reply.postID}`)).json();
		expect(thread.post.replyTo).toEqual({
			postID: parent.postID,
			isDeleted: true,
			author: null,
		});
		expect(thread.ancestors[0]).toMatchObject({ authorID: '', author: null });
	});

	test('a deleted post leaves the feed and the profile lists', async ({
		userApi,
		guestApi,
		account,
	}) => {
		const post = await create(userApi, 'e2e vanishing post');
		await userApi.delete(`${postsUrl}/${post.postID}`);

		const feed = await (await guestApi.get(`${postsUrl}/feed`)).json();
		const own = await (await guestApi.get(`${postsUrl}/user/${account.userID}`)).json();

		for (const { posts } of [feed, own]) {
			expect(posts.some((entry: { postID: string }) => entry.postID === post.postID)).toBe(
				false,
			);
		}
	});

	test('replies to a deleted post stay and still point at it', async ({ userApi, guestApi }) => {
		const parent = await create(userApi, 'e2e deleted parent');
		const reply = await create(userApi, 'e2e surviving reply', parent.postID);
		await userApi.delete(`${postsUrl}/${parent.postID}`);

		const thread = await (await guestApi.get(`${postsUrl}/${reply.postID}`)).json();
		expect(thread.post.content).toBe('e2e surviving reply');
		expect(thread.ancestors).toHaveLength(1);
		expect(thread.ancestors[0]).toMatchObject({ postID: parent.postID, isDeleted: true });

		const { posts } = await (await guestApi.get(`${postsUrl}/${parent.postID}/replies`)).json();
		expect(posts.map((entry: { postID: string }) => entry.postID)).toEqual([reply.postID]);
	});

	test('nobody replies to or edits a deleted post', async ({ userApi }) => {
		const post = await create(userApi, 'e2e closed post');
		await userApi.delete(`${postsUrl}/${post.postID}`);

		const reply = await userApi.post(postsUrl, {
			data: { content: 'e2e late reply', parentPostID: post.postID },
		});
		expect(reply.status()).toBe(409);
		expect((await reply.json()).errorDetails.code).toBe('parentDeleted');

		const edit = await userApi.patch(`${postsUrl}/${post.postID}`, {
			data: { content: 'e2e resurrected' },
		});
		expect(edit.status()).toBe(404);
	});

	test('only the author can delete, and only once', async ({
		userApi,
		otherAccount,
		playwright,
		guestApi,
	}) => {
		const post = await create(userApi, 'e2e not yours');
		const other = await playwright.request.newContext();
		await other.post(`${API_URL}/auth/login`, {
			data: { loginName: otherAccount.userName, password: otherAccount.password },
		});

		expect((await other.delete(`${postsUrl}/${post.postID}`)).status()).toBe(404);
		expect((await guestApi.delete(`${postsUrl}/${post.postID}`)).status()).toBe(401);
		await other.dispose();

		const { post: intact } = await (await guestApi.get(`${postsUrl}/${post.postID}`)).json();
		expect(intact).toMatchObject({ content: 'e2e not yours', isDeleted: false });

		expect((await userApi.delete(`${postsUrl}/${post.postID}`)).status()).toBe(200);
		expect((await userApi.delete(`${postsUrl}/${post.postID}`)).status()).toBe(404);
	});
});
