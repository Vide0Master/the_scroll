import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';

const postsUrl = `${API_URL}/posts`;

// The Redis query cache must be invisible to clients: same answers, but never stale after a write.
test.describe('query cache', () => {
	test('repeated reads return identical data', async ({ userApi, guestApi }) => {
		const { post } = await (
			await userApi.post(postsUrl, { data: { content: 'e2e cache' } })
		).json();

		const first = await (await guestApi.get(`${postsUrl}/${post.postID}`)).json();
		const second = await (await guestApi.get(`${postsUrl}/${post.postID}`)).json();

		expect(second).toEqual(first);
		// Dates survive the cache round trip as the same ISO strings.
		expect(second.post.createdAt).toBe(first.post.createdAt);
	});

	test('the feed reflects every create and edit immediately', async ({ userApi, guestApi }) => {
		const readFeed = async () =>
			(await (await guestApi.get(`${postsUrl}/feed`)).json()).posts as {
				postID: string;
				content: string;
			}[];

		await readFeed();
		const { post } = await (await userApi.post(postsUrl, { data: { content: 'v1' } })).json();
		expect((await readFeed()).find((entry) => entry.postID === post.postID)?.content).toBe(
			'v1',
		);

		await userApi.patch(`${postsUrl}/${post.postID}`, { data: { content: 'v2' } });
		expect((await readFeed()).find((entry) => entry.postID === post.postID)?.content).toBe(
			'v2',
		);
	});

	test('a session stays valid across cached reads', async ({ userApi }) => {
		for (let i = 0; i < 3; i++) {
			expect((await userApi.get(`${API_URL}/users/me`)).status()).toBe(200);
		}
	});
});
