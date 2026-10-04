import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { API_URL, BASE_URL } from '../support/env';
import { expect, test } from '../support/fixtures';
import { internalHeaders, mediaInternalUrl, sweep } from '../support/internal';
import { png } from '../support/media';

const uploadDir = path.resolve(import.meta.dirname, '../../services/media-service/uploads');
const HOUR = 60 * 60 * 1000;

async function upload(api: APIRequestContext, name = 'pic.png') {
	const response = await api.post(`${API_URL}/media/upload`, {
		multipart: { file: { name, mimeType: 'image/png', buffer: png } },
	});
	const { file } = await response.json();
	return file as { id: string; url: string };
}

const storedName = (url: string) => path.basename(url);

// The account is shared by every test of the worker: start each test without leftover uploads.
test.beforeEach(async ({ userApi, account }) => {
	await sweep(userApi, { ownerID: account.userID });
});
test.afterEach(async ({ userApi, account }) => {
	await sweep(userApi, { ownerID: account.userID });
});
const isServed = async (api: APIRequestContext, url: string) =>
	(await api.get(`${BASE_URL}${url}`)).status() === 200;

test.describe('upload tracking', () => {
	test('the stored name follows the checked type, not the client file name', async ({
		userApi,
	}) => {
		const file = await upload(userApi, '../../evil.exe');

		expect(file.url).toMatch(/^\/api\/media\/file\/[0-9a-f-]{36}\.png$/);
	});

	test('a new upload is not an orphan inside the grace period, and a dry run deletes nothing', async ({
		userApi,
		account,
	}) => {
		const file = await upload(userApi);

		const withinGrace = await sweep(userApi, { ownerID: account.userID, graceMs: 24 * HOUR });
		const dryRun = await sweep(userApi, { ownerID: account.userID, dryRun: true });

		expect(withinGrace.candidates).toEqual([]);
		expect(dryRun.candidates).toEqual([storedName(file.url)]);
		expect(dryRun.deleted).toBe(0);
		expect(await isServed(userApi, file.url)).toBe(true);
	});

	test('an upload nobody claimed is deleted once the grace period is over', async ({
		userApi,
		account,
	}) => {
		const file = await upload(userApi);

		const result = await sweep(userApi, { ownerID: account.userID });

		expect(result).toMatchObject({ deleted: 1, candidates: [storedName(file.url)] });
		expect(await isServed(userApi, file.url)).toBe(false);
		expect((await sweep(userApi, { ownerID: account.userID })).candidates).toEqual([]);
	});

	test('sweeping never touches another uploader’s files', async ({
		userApi,
		account,
		otherAccount,
	}) => {
		const file = await upload(userApi);

		const result = await sweep(userApi, { ownerID: otherAccount.userID });

		expect(result.candidates).toEqual([]);
		expect(await isServed(userApi, file.url)).toBe(true);
		await sweep(userApi, { ownerID: account.userID });
	});
});

test.describe('posts keep their files alive', () => {
	test('a file used by a post survives the sweep until an edit drops it', async ({
		userApi,
		account,
	}) => {
		const kept = await upload(userApi);
		const dropped = await upload(userApi);
		const { post } = await (
			await userApi.post(`${API_URL}/posts`, {
				data: { content: 'with two files', mediaUrls: [kept.url, dropped.url] },
			})
		).json();

		expect((await sweep(userApi, { ownerID: account.userID })).candidates).toEqual([]);

		await userApi.patch(`${API_URL}/posts/${post.postID}`, {
			data: { content: 'with one file', mediaUrls: [kept.url] },
		});
		const result = await sweep(userApi, { ownerID: account.userID });

		expect(result.candidates).toEqual([storedName(dropped.url)]);
		expect(await isServed(userApi, kept.url)).toBe(true);
		expect(await isServed(userApi, dropped.url)).toBe(false);
	});

	test('emptying the media list of a post releases every file', async ({ userApi, account }) => {
		const file = await upload(userApi);
		const { post } = await (
			await userApi.post(`${API_URL}/posts`, {
				data: { content: 'one file', mediaUrls: [file.url] },
			})
		).json();

		await userApi.patch(`${API_URL}/posts/${post.postID}`, { data: { content: 'no files' } });

		expect((await sweep(userApi, { ownerID: account.userID })).deleted).toBe(1);
	});

	test('a file shared by two posts lives until both let go', async ({ userApi, account }) => {
		const file = await upload(userApi);
		const create = async () =>
			(
				await (
					await userApi.post(`${API_URL}/posts`, {
						data: { content: 'shared', mediaUrls: [file.url] },
					})
				).json()
			).post;
		const first = await create();
		const second = await create();

		await userApi.patch(`${API_URL}/posts/${first.postID}`, { data: { content: 'first' } });
		expect((await sweep(userApi, { ownerID: account.userID })).candidates).toEqual([]);

		await userApi.patch(`${API_URL}/posts/${second.postID}`, { data: { content: 'second' } });
		expect((await sweep(userApi, { ownerID: account.userID })).deleted).toBe(1);
	});

	test('someone else’s upload can’t be attached to a post, and no post is created', async ({
		userApi,
		guestApi,
		otherAccount,
		playwright,
		account,
	}) => {
		const foreign = await upload(userApi);
		const thief = await playwright.request.newContext();
		await thief.post(`${API_URL}/auth/login`, {
			data: { loginName: otherAccount.userName, password: otherAccount.password },
		});

		const response = await thief.post(`${API_URL}/posts`, {
			data: { content: 'e2e stolen file', mediaUrls: [foreign.url] },
		});
		const body = await response.json();
		await thief.dispose();

		expect(response.status()).toBe(403);
		expect(body.errorDetails.code).toBe('mediaNotOwned');
		const { posts } = await (await guestApi.get(`${API_URL}/posts/feed`)).json();
		expect(posts.some((post: { content: string }) => post.content === 'e2e stolen file')).toBe(
			false,
		);
		await sweep(userApi, { ownerID: account.userID });
	});
});

test.describe('profile files', () => {
	test('an avatar stays while it is set and is released when cleared', async ({
		userApi,
		account,
	}) => {
		const avatar = await upload(userApi);
		const empty = { visibleName: null, avatarUrl: null, bannerUrl: null, bannerGradient: null };

		await userApi.put(`${API_URL}/users/me/profile`, {
			data: { ...empty, avatarUrl: avatar.url },
		});
		expect((await sweep(userApi, { ownerID: account.userID })).candidates).toEqual([]);

		await userApi.put(`${API_URL}/users/me/profile`, { data: empty });
		expect((await sweep(userApi, { ownerID: account.userID })).deleted).toBe(1);
	});

	test('someone else’s upload can’t become an avatar and the profile stays unchanged', async ({
		userApi,
		otherAccount,
		playwright,
		account,
	}) => {
		const foreign = await upload(userApi);
		const other = await playwright.request.newContext();
		await other.post(`${API_URL}/auth/login`, {
			data: { loginName: otherAccount.userName, password: otherAccount.password },
		});

		const response = await other.put(`${API_URL}/users/me/profile`, {
			data: {
				visibleName: 'Thief',
				avatarUrl: foreign.url,
				bannerUrl: null,
				bannerGradient: null,
			},
		});
		const me = await (await other.get(`${API_URL}/users/me`)).json();
		await other.dispose();

		expect(response.status()).toBe(403);
		expect(me.userData).toMatchObject({ visibleName: null, avatarUrl: null });
		await sweep(userApi, { ownerID: account.userID });
	});
});

test.describe('files without a record', () => {
	test('a file found on disk is imported as legacy and never swept', async ({
		userApi,
		account,
	}) => {
		const name = `${randomUUID()}.png`;
		await fs.writeFile(path.join(uploadDir, name), png);

		try {
			const result = await sweep(userApi, { ownerID: account.userID });

			expect(result.candidates).not.toContain(name);
			expect(await isServed(userApi, `/api/media/file/${name}`)).toBe(true);
			// Even a sweep that isn't limited to one uploader leaves it alone.
			const everyone = await userApi.post(mediaInternalUrl('sweep'), {
				headers: internalHeaders,
				data: { dryRun: true, graceMs: 0 },
			});
			expect((await everyone.json()).candidates).not.toContain(name);
		} finally {
			await fs.rm(path.join(uploadDir, name), { force: true });
		}
	});
});

test.describe('internal routes', () => {
	test('need the shared token', async ({ guestApi }) => {
		const wrongToken: Record<string, string> = {};
		wrongToken['x-internal-token'] = 'wrong';

		for (const headers of [{} as Record<string, string>, wrongToken]) {
			const usage = await guestApi.put(mediaInternalUrl('usage'), { headers, data: {} });
			const sweepCall = await guestApi.post(mediaInternalUrl('sweep'), { headers, data: {} });

			expect(usage.status()).toBe(401);
			expect(sweepCall.status()).toBe(401);
		}
	});

	test('are not reachable through the public /api proxy', async ({ guestApi }) => {
		const response = await guestApi.post(`${API_URL}/media/internal/media/sweep`, {
			headers: internalHeaders,
			data: {},
		});

		expect(response.status()).toBe(404);
	});

	test('reject a malformed usage request', async ({ guestApi }) => {
		const bad = [
			{},
			{ ownerID: 'u', usages: [] },
			{ ownerID: 'u', usages: [{ kind: 'nope', refID: 'r', urls: [] }] },
			{ ownerID: 'u', usages: [{ kind: 'post', refID: 'r', urls: [42] }] },
		];

		for (const data of bad) {
			const response = await guestApi.put(mediaInternalUrl('usage'), {
				headers: internalHeaders,
				data,
			});

			expect(response.status()).toBe(400);
		}
	});

	test('a sweep without dryRun:false only reports', async ({ userApi, account }) => {
		const file = await upload(userApi);

		const response = await userApi.post(mediaInternalUrl('sweep'), {
			headers: internalHeaders,
			data: { graceMs: 0, ownerID: account.userID },
		});

		expect(await response.json()).toMatchObject({ dryRun: true, deleted: 0 });
		expect(await isServed(userApi, file.url)).toBe(true);
		await sweep(userApi, { ownerID: account.userID });
	});
});
