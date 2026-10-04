import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { prisma as userDb } from '../../services/user-service/src/lib/prisma';
import { createAccount, deleteAccount } from '../support/accounts';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';

const postsUrl = `${API_URL}/posts`;

async function create(api: APIRequestContext, content: string) {
	return (await (await api.post(postsUrl, { data: { content } })).json()).post as {
		postID: string;
	};
}

async function found(api: APIRequestContext, q: string) {
	const response = await api.get(`${postsUrl}/search`, { params: { q } });
	return {
		status: response.status(),
		ids: ((await response.json()).posts ?? []).map((post: { postID: string }) => post.postID),
	};
}

// Unique per test, letters only, so leftovers of an aborted run never match.
const word = () =>
	`zq${
		randomUUID()
			.replace(/[^a-f]/g, '')
			.slice(0, 8) || 'abcdef'
	}x`;

test.describe('post search', () => {
	test('finds posts by a word, in any case, publicly', async ({ userApi, guestApi }) => {
		const w = word();
		const post = await create(userApi, `Some Text with ${w.toUpperCase()} inside`);

		expect((await found(guestApi, w)).ids).toEqual([post.postID]);
		expect((await found(guestApi, w.slice(0, 6))).ids).toEqual([post.postID]);
	});

	test('all words must match, in any order', async ({ userApi, guestApi }) => {
		const [a, b] = [word(), word()];
		const both = await create(userApi, `${a} and ${b}`);
		await create(userApi, `only ${a}`);

		expect((await found(guestApi, `${b} ${a}`)).ids).toEqual([both.postID]);
	});

	test('a #hashtag must be a hashtag of the post, not just text', async ({
		userApi,
		guestApi,
	}) => {
		const tag = word();
		const tagged = await create(userApi, `about #${tag}`);
		await create(userApi, `mentions ${tag} in plain text only`);

		expect((await found(guestApi, `#${tag}`)).ids).toEqual([tagged.postID]);
		// Words and a tag together.
		expect((await found(guestApi, `about #${tag}`)).ids).toEqual([tagged.postID]);
	});

	test('a deleted post is not found', async ({ userApi, guestApi }) => {
		const w = word();
		const post = await create(userApi, `going away ${w}`);
		await userApi.delete(`${postsUrl}/${post.postID}`);

		expect((await found(guestApi, w)).ids).toEqual([]);
	});

	test('a query with nothing searchable is 400', async ({ guestApi }) => {
		expect((await found(guestApi, 'a')).status).toBe(400);
		expect((await found(guestApi, '   ')).status).toBe(400);
		expect((await found(guestApi, '#123')).status).toBe(400);
		expect((await found(guestApi, 'x'.repeat(101))).status).toBe(400);
	});

	test('wildcard characters are searched as text', async ({ userApi, guestApi }) => {
		const w = word();
		await create(userApi, `plain ${w}`);

		expect((await found(guestApi, '%%')).ids).toEqual([]);
		expect((await found(guestApi, `${w.slice(0, 3)}_`)).ids).toEqual([]);
	});
});

test.describe('hashtag hints', () => {
	const tags = async (api: APIRequestContext, q: string, match?: string) =>
		(await (await api.get(`${postsUrl}/tags`, { params: match ? { q, match } : { q } })).json())
			.tags as {
			tag: string;
			count: number;
		}[];

	test('lists matching tags, the most used first, with their counts', async ({
		userApi,
		guestApi,
	}) => {
		const base = word();
		await create(userApi, `one #${base}pop`);
		await create(userApi, `two #${base}pop`);
		await create(userApi, `three #${base}rare`);

		expect(await tags(guestApi, base)).toEqual([
			{ tag: `${base}pop`, count: 2 },
			{ tag: `${base}rare`, count: 1 },
		]);
		// A leading "#" is fine, and the middle of a tag only matches in contains mode.
		expect((await tags(guestApi, `#${base}`)).length).toBe(2);
		expect(await tags(guestApi, base.slice(2, 6))).toEqual([]);
		expect((await tags(guestApi, base.slice(2, 6), 'contains')).length).toBe(2);
	});

	test('an unusable query is an empty list, and deleted posts stop counting', async ({
		userApi,
		guestApi,
	}) => {
		expect(await tags(guestApi, '')).toEqual([]);
		expect(await tags(guestApi, '12')).toEqual([]);

		const tag = word();
		const post = await create(userApi, `#${tag}`);
		await userApi.delete(`${postsUrl}/${post.postID}`);

		expect(await tags(guestApi, tag)).toEqual([]);
	});
});

test.describe('people search', () => {
	const people = async (api: APIRequestContext, q: string, params = '') =>
		(
			(
				await (
					await api.get(`${API_URL}/users/search/${encodeURIComponent(q)}${params}`)
				).json()
			).users as { userName: string }[]
		).map((user) => user.userName);

	test('the middle of a name matches only in contains mode', async ({
		guestApi,
		otherAccount,
	}) => {
		const middle = otherAccount.userName.slice(2, 10);

		expect(await people(guestApi, middle)).not.toContain(otherAccount.userName);
		expect(await people(guestApi, middle, '?match=contains')).toContain(otherAccount.userName);
	});

	test('blocked accounts are not offered', async ({ guestApi }) => {
		const target = await createAccount();

		try {
			await userDb.user.update({
				where: { userID: target.userID },
				data: { bannedAt: new Date() },
			});

			expect(await people(guestApi, target.userName, '?match=contains')).not.toContain(
				target.userName,
			);
		} finally {
			await deleteAccount(target);
		}
	});
});
