import type { APIRequestContext } from '@playwright/test';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';

const postsUrl = `${API_URL}/posts`;

async function page(api: APIRequestContext, url: string, params: Record<string, string | number>) {
	const response = await api.get(url, { params });
	return { status: response.status(), body: await response.json() };
}

test.describe('cursor paging', () => {
	test('an author’s posts come page by page without gaps or repeats', async ({
		userApi,
		guestApi,
		account,
	}) => {
		const created: string[] = [];

		for (let n = 0; n < 7; n++) {
			created.unshift(
				(await (await userApi.post(postsUrl, { data: { content: `paged ${n}` } })).json())
					.post.postID,
			);
		}

		const seen: string[] = [];
		let cursor: string | undefined;

		for (let pages = 0; pages < 10; pages++) {
			const { body } = await page(guestApi, `${postsUrl}/user/${account.userID}`, {
				limit: 3,
				...(cursor ? { cursor } : {}),
			});
			seen.push(...body.posts.map((post: { postID: string }) => post.postID));
			cursor = body.nextCursor;

			if (!cursor) {
				break;
			}
		}

		// Newest first, every post exactly once, and the last page has no cursor.
		expect(seen).toEqual(created);
		expect(cursor).toBeUndefined();
	});

	test('the feed pages too, and a malformed cursor is refused', async ({ userApi, guestApi }) => {
		await userApi.post(postsUrl, { data: { content: 'feed one' } });
		await userApi.post(postsUrl, { data: { content: 'feed two' } });

		const first = await page(guestApi, `${postsUrl}/feed`, { limit: 1 });
		expect(first.body.posts).toHaveLength(1);
		expect(first.body.nextCursor).toBeTruthy();

		const second = await page(guestApi, `${postsUrl}/feed`, {
			limit: 1,
			cursor: first.body.nextCursor,
		});
		expect(second.body.posts[0].postID).not.toBe(first.body.posts[0].postID);

		expect((await page(guestApi, `${postsUrl}/feed`, { cursor: 'nonsense' })).status).toBe(400);
	});

	test('replies (oldest first), a hashtag and a search page through as well', async ({
		userApi,
		guestApi,
	}) => {
		const tag = `zqpage${Date.now().toString(36).replace(/[0-9]/g, 'x')}`;
		const root = (
			await (await userApi.post(postsUrl, { data: { content: `root #${tag}` } })).json()
		).post.postID as string;
		const replies: string[] = [];

		for (let n = 0; n < 5; n++) {
			replies.push(
				(
					await (
						await userApi.post(postsUrl, {
							data: { content: `reply ${n} #${tag}`, parentPostID: root },
						})
					).json()
				).post.postID,
			);
		}

		async function walk(url: string, params: Record<string, string | number>) {
			const seen: string[] = [];
			let cursor: string | undefined;

			for (let pages = 0; pages < 10; pages++) {
				const { body } = await page(guestApi, url, {
					...params,
					limit: 2,
					...(cursor ? { cursor } : {}),
				});
				seen.push(...body.posts.map((post: { postID: string }) => post.postID));
				cursor = body.nextCursor;

				if (!cursor) {
					break;
				}
			}

			return seen;
		}

		expect(await walk(`${postsUrl}/${root}/replies`, {})).toEqual(replies);
		// Root plus five replies carry the tag; newest first.
		expect(await walk(`${postsUrl}/hashtag/${tag}`, {})).toEqual(
			[...replies].reverse().concat(root),
		);
		expect(await walk(`${postsUrl}/search`, { q: `#${tag}` })).toEqual(
			[...replies].reverse().concat(root),
		);
	});
});
