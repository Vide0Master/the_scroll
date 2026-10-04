import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';

async function createPost(api: APIRequestContext, content: string, parentPostID?: string) {
	const response = await api.post(`${API_URL}/posts`, { data: { content, parentPostID } });
	return (await response.json()).post as { postID: string };
}

// Unique text: leftovers of an aborted run must not match a card twice.
const unique = (label: string) => `${label} ${randomUUID().slice(0, 8)}`;

test.describe('replying', () => {
	test('replies to a post from its page: the reply shows up and the counter grows', async ({
		userPage,
		userApi,
	}) => {
		const text = unique('e2e parent');
		const reply = unique('e2e my reply');
		const post = await createPost(userApi, text);
		await userPage.goto(`/post/${post.postID}`);

		await expect(userPage.getByText('No replies yet.')).toBeVisible();
		await userPage.getByPlaceholder('Post your reply').fill(reply);
		await userPage.locator('form').getByRole('button', { name: 'Reply', exact: true }).click();

		const card = userPage.locator('article', { hasText: reply });
		await expect(card).toBeVisible();
		await expect(card).toContainText('Replying to');
		await expect(userPage.locator('article', { hasText: text }).first()).toContainText(
			'[Reply 1]',
		);
		await expect(userPage.getByText('No replies yet.')).toHaveCount(0);
		await expect(userPage.getByPlaceholder('Post your reply')).toHaveValue('');
	});

	test('the [reply] button of a card opens the post with the reply box focused', async ({
		userPage,
		userApi,
	}) => {
		const text = unique('e2e reply button');
		const post = await createPost(userApi, text);
		await userPage.goto('/');

		await userPage
			.locator('article', { hasText: text })
			.getByRole('button', { name: '[Reply]' })
			.click();

		await expect(userPage).toHaveURL(`/post/${post.postID}`);
		await expect(userPage.getByPlaceholder('Post your reply')).toBeFocused();
	});

	test('a guest sees the thread but is asked to log in to reply', async ({ page, userApi }) => {
		const text = unique('e2e guest thread');
		const reply = unique('e2e guest sees');
		const post = await createPost(userApi, text);
		await createPost(userApi, reply, post.postID);

		await page.goto(`/post/${post.postID}`);

		await expect(page.locator('article', { hasText: reply })).toBeVisible();
		await expect(page.getByText('Log in to reply.')).toBeVisible();
		await expect(page.getByPlaceholder('Post your reply')).toHaveCount(0);
	});
});

test.describe('threads', () => {
	test('a reply says who it answers, in the feed too, and the label opens the parent', async ({
		userPage,
		userApi,
		account,
	}) => {
		const parentText = unique('e2e feed parent');
		const replyText = unique('e2e feed reply');
		const parent = await createPost(userApi, parentText);
		await createPost(userApi, replyText, parent.postID);
		await userPage.goto('/');

		const card = userPage.locator('article', { hasText: replyText });
		await expect(card).toContainText(`Replying to @${account.userName}`);
		await card.getByRole('link', { name: `Replying to @${account.userName}` }).click();

		await expect(userPage).toHaveURL(`/post/${parent.postID}`);
	});

	test('a reply page shows the chain it answers above it', async ({ userPage, userApi }) => {
		const rootText = unique('e2e chain root');
		const midText = unique('e2e chain middle');
		const leafText = unique('e2e chain leaf');
		const root = await createPost(userApi, rootText);
		const mid = await createPost(userApi, midText, root.postID);
		const leaf = await createPost(userApi, leafText, mid.postID);

		await userPage.goto(`/post/${leaf.postID}`);

		const cards = userPage.locator('article');
		await expect(cards.nth(0)).toContainText(rootText);
		await expect(cards.nth(1)).toContainText(midText);
		await expect(cards.nth(2)).toContainText(leafText);
	});

	test('the profile Replies tab lists replies, the Posts tab does not', async ({
		userPage,
		userApi,
		account,
	}) => {
		const rootText = unique('e2e tab root');
		const replyText = unique('e2e tab reply');
		const root = await createPost(userApi, rootText);
		await createPost(userApi, replyText, root.postID);

		await userPage.goto(`/u/${account.userName}`);
		await expect(userPage.locator('article', { hasText: rootText })).toBeVisible();
		await expect(userPage.locator('article', { hasText: replyText })).toHaveCount(0);

		await userPage.getByRole('tab', { name: 'Replies' }).click();

		const card = userPage.locator('article', { hasText: replyText });
		await expect(card).toBeVisible();
		await expect(card).toContainText(`Replying to @${account.userName}`);
		await expect(userPage.locator('article', { hasText: rootText })).toHaveCount(0);
	});

	test('the Replies tab of an account without replies says so', async ({
		page,
		otherAccount,
	}) => {
		await page.goto(`/u/${otherAccount.userName}`);
		await page.getByRole('tab', { name: 'Replies' }).click();

		await expect(page.getByText('No replies yet.')).toBeVisible();
	});
});
