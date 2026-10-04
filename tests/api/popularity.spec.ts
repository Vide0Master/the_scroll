import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';
import { setRoles, signIn } from '../support/session';

const postsUrl = `${API_URL}/posts`;

const word = () =>
	`zq${
		randomUUID()
			.replace(/[^a-f]/g, '')
			.slice(0, 8) || 'abcdef'
	}x`;

async function create(api: APIRequestContext, content: string) {
	return (await (await api.post(postsUrl, { data: { content } })).json()).post as {
		postID: string;
	};
}

async function getPost(api: APIRequestContext, postID: string) {
	return (await (await api.get(`${postsUrl}/${postID}`)).json()).post as {
		likeCount: number;
		likedByMe: boolean;
		viewCount: number;
	};
}

test.describe('likes', () => {
	test('a like counts once per account and can be taken back', async ({
		playwright,
		userApi,
		guestApi,
		otherAccount,
	}) => {
		const post = await create(userApi, 'like me');
		const fan = await signIn(playwright, otherAccount);

		try {
			expect((await fan.put(`${postsUrl}/${post.postID}/like`)).status()).toBe(200);
			// Liking twice does not add up.
			const again = await (await fan.put(`${postsUrl}/${post.postID}/like`)).json();
			expect(again.likeCount).toBe(1);

			expect(await getPost(fan, post.postID)).toMatchObject({
				likeCount: 1,
				likedByMe: true,
			});
			expect(await getPost(guestApi, post.postID)).toMatchObject({
				likeCount: 1,
				likedByMe: false,
			});

			const undone = await (await fan.delete(`${postsUrl}/${post.postID}/like`)).json();
			expect(undone.likeCount).toBe(0);
		} finally {
			await fan.dispose();
		}
	});

	test('guests cannot like, and a deleted post cannot be liked', async ({
		userApi,
		guestApi,
	}) => {
		const post = await create(userApi, 'to be deleted');

		expect((await guestApi.put(`${postsUrl}/${post.postID}/like`)).status()).toBe(401);

		await userApi.delete(`${postsUrl}/${post.postID}`);
		expect((await userApi.put(`${postsUrl}/${post.postID}/like`)).status()).toBe(404);
	});
});

test.describe('views', () => {
	test('a view counts once per signed-in account, never the author or guests', async ({
		playwright,
		userApi,
		guestApi,
		otherAccount,
	}) => {
		const post = await create(userApi, 'look at me');
		const reader = await signIn(playwright, otherAccount);

		try {
			await reader.post(`${postsUrl}/${post.postID}/view`);
			await reader.post(`${postsUrl}/${post.postID}/view`);
			await userApi.post(`${postsUrl}/${post.postID}/view`);
			expect((await guestApi.post(`${postsUrl}/${post.postID}/view`)).status()).toBe(401);

			expect((await getPost(guestApi, post.postID)).viewCount).toBe(1);
		} finally {
			await reader.dispose();
		}
	});
});

test.describe('trending', () => {
	test('a hashtag rises with likes from other accounts, not the author’s own', async ({
		playwright,
		userApi,
		guestApi,
		otherAccount,
	}) => {
		const tag = word();
		const post = await create(userApi, `about #${tag}`);
		const fan = await signIn(playwright, otherAccount);

		try {
			// Self-likes do not count.
			await userApi.put(`${postsUrl}/${post.postID}/like`);
			await fan.put(`${postsUrl}/${post.postID}/like`);

			const { tags, users } = await (
				await guestApi.get(`${postsUrl}/trending`, { params: { limit: 20 } })
			).json();

			expect(tags).toContainEqual({ tag, score: 1 });
			// The author list is ranked against everyone (seeded demo data included), so only its
			// shape is checked here; the score rules are covered by the tag above.
			expect(users.length).toBeGreaterThan(0);
		} finally {
			await fan.dispose();
		}
	});
});

test.describe('metrics', () => {
	test.afterEach(async ({ account }) => {
		await setRoles(account, []);
	});

	test('only moderators and admins read the numbers', async ({
		playwright,
		userApi,
		guestApi,
		account,
	}) => {
		expect((await guestApi.get(`${postsUrl}/admin/metrics`)).status()).toBe(401);
		expect((await userApi.get(`${postsUrl}/admin/metrics`)).status()).toBe(403);
		expect((await userApi.get(`${API_URL}/users/admin/metrics`)).status()).toBe(403);

		await setRoles(account, ['MODERATOR']);
		const moderator = await signIn(playwright, account);

		try {
			const posts = await (await moderator.get(`${postsUrl}/admin/metrics`)).json();
			const users = await (await moderator.get(`${API_URL}/users/admin/metrics`)).json();

			expect(posts.metrics).toMatchObject({
				posts: expect.any(Number),
				likes: expect.any(Number),
			});
			expect(users.metrics).toMatchObject({ users: expect.any(Number) });
		} finally {
			await moderator.dispose();
		}
	});
});
