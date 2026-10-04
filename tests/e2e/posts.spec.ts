import { randomUUID } from 'node:crypto';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';
import { png, removeUploaded } from '../support/media';

async function createPostViaApi(
	api: import('@playwright/test').APIRequestContext,
	data: { content: string; mediaUrls?: string[] },
) {
	const response = await api.post(`${API_URL}/posts`, { data });
	return (await response.json()).post as { postID: string };
}

test.describe('feed', () => {
	test('publishes a post and shows it in the feed', async ({ userPage, account }) => {
		// Unique text: leftovers of an aborted earlier run must not match this card too.
		const text = `e2e hello feed ${randomUUID().slice(0, 8)}`;
		await userPage.goto('/');

		await userPage.getByPlaceholder("What's happening?").fill(text);
		await userPage.locator('form').getByRole('button', { name: 'Post', exact: true }).click();

		const card = userPage.locator('article', { hasText: text });
		await expect(card).toBeVisible();
		await expect(card).toContainText(`@${account.userName}`);
		await expect(userPage.getByPlaceholder("What's happening?")).toHaveValue('');
	});

	test('attaches an image to a post and removes the stored file afterwards', async ({
		userPage,
		userApi,
		account,
	}) => {
		await userPage.goto('/');

		await userPage.locator('input[type=file]').setInputFiles({
			name: 'pixel.png',
			mimeType: 'image/png',
			buffer: png,
		});
		await userPage.getByPlaceholder("What's happening?").fill('e2e with image');
		await userPage.locator('form').getByRole('button', { name: 'Post', exact: true }).click();

		const card = userPage.locator('article', { hasText: 'e2e with image' });
		await expect(card.getByRole('button', { name: 'View image 1 of 1' })).toBeVisible();

		const { posts } = await (
			await userApi.get(`${API_URL}/posts/user/${account.userID}`)
		).json();
		await removeUploaded(posts.flatMap((post: { media: string[] }) => post.media));
	});

	test('offers no compose box to a guest', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByPlaceholder("What's happening?")).toHaveCount(0);
	});
});

test.describe('post card', () => {
	test('clicking empty card space opens the post page with a reply box', async ({
		userPage,
		userApi,
	}) => {
		const post = await createPostViaApi(userApi, { content: 'e2e open me' });
		await userPage.goto('/');

		const card = userPage.locator('article', { hasText: 'e2e open me' });
		// Bottom-right corner of the card: padding, so nothing else handles the click.
		await card.click({ position: { x: 5, y: 5 } });

		await expect(userPage).toHaveURL(`/post/${post.postID}`);
		await expect(userPage.getByPlaceholder('Post your reply')).toBeVisible();
	});

	test('the date is plain text, not a link', async ({ userPage, userApi }) => {
		await createPostViaApi(userApi, { content: 'e2e date' });
		await userPage.goto('/');

		const card = userPage.locator('article', { hasText: 'e2e date' });

		await expect(card.locator('time')).toBeVisible();
		await expect(card.getByRole('link').filter({ has: userPage.locator('time') })).toHaveCount(
			0,
		);
	});

	test('the avatar opens the author profile, not the post', async ({
		userPage,
		userApi,
		account,
	}) => {
		await createPostViaApi(userApi, { content: 'e2e to profile' });
		await userPage.goto('/');

		await userPage
			.locator('article', { hasText: 'e2e to profile' })
			.getByRole('link', { name: account.userName, exact: true })
			.first()
			.click();

		await expect(userPage).toHaveURL(`/u/${account.userName}`);
	});

	test('an image opens in a fullscreen viewer and closes with Escape', async ({
		userPage,
		userApi,
	}) => {
		await createPostViaApi(userApi, {
			content: 'e2e lightbox',
			mediaUrls: ['/api/media/file/e2e-missing-a.png', '/api/media/file/e2e-missing-b.png'],
		});
		await userPage.goto('/');

		const card = userPage.locator('article', { hasText: 'e2e lightbox' });
		await card.getByRole('button', { name: 'View image 2 of 2' }).click();

		const viewer = userPage.getByRole('dialog');
		await expect(viewer).toBeVisible();
		await expect(userPage).toHaveURL('/');

		await userPage.keyboard.press('ArrowLeft');
		await expect(viewer).toHaveAccessibleName('View image 1 of 2');

		await userPage.keyboard.press('Escape');
		await expect(viewer).toHaveCount(0);
	});
});

test.describe('deleting', () => {
	test('the owner deletes a post after confirming and it shows as deleted', async ({
		userPage,
		userApi,
		account,
	}) => {
		const post = await createPostViaApi(userApi, { content: 'e2e doomed post' });
		await userApi.post(`${API_URL}/posts`, {
			data: { content: 'e2e reply to doomed', parentPostID: post.postID },
		});
		await userPage.goto(`/post/${post.postID}`);

		const card = userPage.locator('article', { hasText: 'e2e doomed post' });
		await card.getByRole('button', { name: '[Delete]' }).click();
		const dialog = userPage.getByRole('dialog', { name: 'Delete this post?' });
		await dialog.getByRole('button', { name: 'Cancel' }).click();
		await expect(card).toContainText('e2e doomed post');

		await card.getByRole('button', { name: '[Delete]' }).click();
		await userPage
			.getByRole('dialog')
			.getByRole('button', { name: 'Delete', exact: true })
			.click();

		const deleted = userPage.locator('article', {
			hasText: 'This post was deleted by its author.',
		});
		await expect(deleted).toBeVisible();
		await expect(userPage.getByText('e2e doomed post')).toHaveCount(0);
		// The author is replaced by a neutral placeholder: no name, no handle, no profile link.
		await expect(deleted).toContainText('Deleted');
		await expect(deleted).not.toContainText(`@${account.userName}`);
		// The opened card has no whole-card link either, so any link would be a profile one.
		await expect(deleted.getByRole('link')).toHaveCount(0);
		await expect(deleted.getByRole('button', { name: '[Delete]' })).toHaveCount(0);
		await expect(userPage.locator('article', { hasText: 'e2e reply to doomed' })).toBeVisible();

		await userPage.reload();
		await expect(userPage.getByText('You cannot reply to a deleted post.')).toBeVisible();
	});

	test("someone else's post has no delete button", async ({
		userPage,
		otherAccount,
		playwright,
	}) => {
		const other = await playwright.request.newContext();
		await other.post(`${API_URL}/auth/login`, {
			data: { loginName: otherAccount.userName, password: otherAccount.password },
		});
		await createPostViaApi(other, { content: 'e2e not deletable' });
		await other.dispose();
		await userPage.goto('/');

		const card = userPage.locator('article', { hasText: 'e2e not deletable' });
		await expect(card).toBeVisible();
		await expect(card.getByRole('button', { name: '[Delete]' })).toHaveCount(0);
	});
});

test.describe('editing', () => {
	test('the owner edits a post in place', async ({ userPage, userApi }) => {
		await createPostViaApi(userApi, { content: 'e2e before edit' });
		await userPage.goto('/');

		const card = userPage.locator('article', { hasText: 'e2e before edit' });
		await card.getByRole('button', { name: '[Edit]' }).click();

		const dialog = userPage.getByRole('dialog', { name: 'Edit' });
		await dialog.getByRole('textbox').fill('e2e after edit');
		await dialog.getByRole('button', { name: 'Save' }).click();

		await expect(dialog).toHaveCount(0);
		await expect(userPage.locator('article', { hasText: 'e2e after edit' })).toBeVisible();
		await expect(userPage).toHaveURL('/');

		await userPage.reload();
		await expect(userPage.locator('article', { hasText: 'e2e after edit' })).toBeVisible();
	});

	test("someone else's post has no edit button", async ({
		userPage,
		playwright,
		otherAccount,
	}) => {
		const other = await playwright.request.newContext();
		await other.post(`${API_URL}/auth/login`, {
			data: { loginName: otherAccount.userName, password: otherAccount.password },
		});
		await createPostViaApi(other, { content: 'e2e not yours' });
		await other.dispose();

		await userPage.goto('/');

		const card = userPage.locator('article', { hasText: 'e2e not yours' });
		await expect(card).toBeVisible();
		await expect(card.getByRole('button', { name: '[Edit]' })).toHaveCount(0);
	});
});

test.describe('post page', () => {
	test('shows a post by its address and a message for an unknown one', async ({
		page,
		userApi,
	}) => {
		const post = await createPostViaApi(userApi, { content: 'e2e permalink' });

		await page.goto(`/post/${post.postID}`);
		await expect(page.getByText('e2e permalink')).toBeVisible();

		await page.goto('/post/00000000-0000-4000-8000-000000000000');
		await expect(page.getByText("This post doesn't exist or was removed.")).toBeVisible();
	});
});
