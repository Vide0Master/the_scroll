import { POST_CONTENT_MAX_LENGTH, POST_MEDIA_MAX_FILES } from '@the-scroll/types';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';

const postsUrl = `${API_URL}/posts`;

test.describe('creating posts', () => {
	test('requires a session', async ({ guestApi }) => {
		const response = await guestApi.post(postsUrl, { data: { content: 'hello' } });

		expect(response.status()).toBe(401);
	});

	test('stores the post for the session user, ignoring a client-sent authorID', async ({
		userApi,
		account,
		otherAccount,
	}) => {
		const response = await userApi.post(postsUrl, {
			data: { content: 'e2e own post', authorID: otherAccount.userID },
		});
		const { post } = await response.json();

		expect(response.status()).toBe(201);
		expect(post).toMatchObject({ content: 'e2e own post', authorID: account.userID });
	});

	test('rejects a post with neither text nor media', async ({ userApi }) => {
		const response = await userApi.post(postsUrl, { data: { content: '   ' } });

		expect(response.status()).toBe(400);
		expect((await response.json()).errorDetails.code).toBe('emptyPost');
	});

	test(`rejects content over ${POST_CONTENT_MAX_LENGTH} characters`, async ({ userApi }) => {
		const response = await userApi.post(postsUrl, {
			data: { content: 'x'.repeat(POST_CONTENT_MAX_LENGTH + 1) },
		});

		expect(response.status()).toBe(400);
		expect((await response.json()).errorDetails.code).toBe('contentTooLong');
	});

	test(`accepts exactly ${POST_MEDIA_MAX_FILES} media items and rejects one more`, async ({
		userApi,
	}) => {
		const urls = (count: number) =>
			Array.from({ length: count }, (_v, i) => `/api/media/file/e2e-${i}.png`);

		const accepted = await userApi.post(postsUrl, {
			data: { content: 'full grid', mediaUrls: urls(POST_MEDIA_MAX_FILES) },
		});
		const rejected = await userApi.post(postsUrl, {
			data: { content: 'too many', mediaUrls: urls(POST_MEDIA_MAX_FILES + 1) },
		});

		expect(accepted.status()).toBe(201);
		expect(rejected.status()).toBe(400);
		expect((await rejected.json()).errorDetails.code).toBe('tooManyFiles');
	});

	test('rejects malformed field types', async ({ userApi }) => {
		const badContent = await userApi.post(postsUrl, { data: { content: 42 } });
		const badMedia = await userApi.post(postsUrl, {
			data: { content: 'hi', mediaUrls: 'not-an-array' },
		});
		const emptyUrl = await userApi.post(postsUrl, { data: { content: 'hi', mediaUrls: [''] } });

		expect(badContent.status()).toBe(400);
		expect(badMedia.status()).toBe(400);
		expect((await emptyUrl.json()).errorDetails.code).toBe('invalidMedia');
	});
});

test.describe('reading posts', () => {
	test('a post is public and carries its author', async ({ userApi, guestApi, account }) => {
		const { post } = await (
			await userApi.post(postsUrl, { data: { content: 'e2e read' } })
		).json();

		const response = await guestApi.get(`${postsUrl}/${post.postID}`);
		const body = await response.json();

		expect(response.status()).toBe(200);
		expect(body.post).toMatchObject({ postID: post.postID, content: 'e2e read' });
		expect(body.post.author).toMatchObject({
			userID: account.userID,
			userName: account.userName,
		});
	});

	test('an unknown post is 404 and an oversized id is 400', async ({ guestApi }) => {
		const missing = await guestApi.get(`${postsUrl}/00000000-0000-4000-8000-000000000000`);
		const tooLong = await guestApi.get(`${postsUrl}/${'a'.repeat(65)}`);

		expect(missing.status()).toBe(404);
		expect((await missing.json()).errorDetails.code).toBe('postNotFound');
		expect(tooLong.status()).toBe(400);
	});

	test('the feed lists a new post right away', async ({ userApi, guestApi }) => {
		await guestApi.get(`${postsUrl}/feed`); // warm the cache before the write
		const { post } = await (
			await userApi.post(postsUrl, { data: { content: 'e2e feed' } })
		).json();

		const { posts } = await (await guestApi.get(`${postsUrl}/feed`)).json();

		expect(posts.map((entry: { postID: string }) => entry.postID)).toContain(post.postID);
	});

	test("an author's posts are listed by author id", async ({ userApi, guestApi, account }) => {
		const { post } = await (
			await userApi.post(postsUrl, { data: { content: 'e2e mine' } })
		).json();

		const { posts } = await (await guestApi.get(`${postsUrl}/user/${account.userID}`)).json();

		expect(posts.map((entry: { postID: string }) => entry.postID)).toContain(post.postID);
		expect(
			posts.every((entry: { authorID: string }) => entry.authorID === account.userID),
		).toBe(true);
	});
});

test.describe('editing posts', () => {
	test('the owner can replace content and media in full', async ({ userApi, guestApi }) => {
		const { post } = await (
			await userApi.post(postsUrl, {
				data: { content: 'before', mediaUrls: ['/a.png', '/b.png'] },
			})
		).json();

		const response = await userApi.patch(`${postsUrl}/${post.postID}`, {
			data: { content: 'after', mediaUrls: ['/c.png'] },
		});

		expect(response.status()).toBe(200);
		expect((await response.json()).post).toMatchObject({ content: 'after', media: ['/c.png'] });

		// Read-your-write: the cached copy of the post must not survive the edit.
		const { post: fresh } = await (await guestApi.get(`${postsUrl}/${post.postID}`)).json();
		expect(fresh).toMatchObject({ content: 'after', media: ['/c.png'] });
	});

	test('applies the same validation as creating', async ({ userApi }) => {
		const { post } = await (
			await userApi.post(postsUrl, { data: { content: 'keep me' } })
		).json();

		const response = await userApi.patch(`${postsUrl}/${post.postID}`, {
			data: { content: '' },
		});

		expect(response.status()).toBe(400);
		expect((await response.json()).errorDetails.code).toBe('emptyPost');
	});

	test('needs a session', async ({ userApi, guestApi }) => {
		const { post } = await (await userApi.post(postsUrl, { data: { content: 'mine' } })).json();

		const response = await guestApi.patch(`${postsUrl}/${post.postID}`, {
			data: { content: 'hijacked' },
		});

		expect(response.status()).toBe(401);
	});

	test('someone else gets the same 404 as for a missing post, and nothing changes', async ({
		userApi,
		guestApi,
		otherAccount,
		playwright,
	}) => {
		const { post } = await (await userApi.post(postsUrl, { data: { content: 'mine' } })).json();

		const intruder = await playwright.request.newContext();
		await intruder.post(`${API_URL}/auth/login`, {
			data: { loginName: otherAccount.userName, password: otherAccount.password },
		});
		const foreign = await intruder.patch(`${postsUrl}/${post.postID}`, {
			data: { content: 'hijacked' },
		});
		const missing = await intruder.patch(`${postsUrl}/00000000-0000-4000-8000-000000000000`, {
			data: { content: 'hijacked' },
		});
		const foreignBody = await foreign.json();
		const missingBody = await missing.json();
		await intruder.dispose();

		expect(foreign.status()).toBe(404);
		// Identical answers: a non-owner can't tell "exists but not yours" from "doesn't exist".
		expect(foreignBody).toEqual(missingBody);
		expect((await (await guestApi.get(`${postsUrl}/${post.postID}`)).json()).post.content).toBe(
			'mine',
		);
	});
});
