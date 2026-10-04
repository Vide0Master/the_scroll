import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';
import { signIn } from '../support/session';

const composer = (page: import('@playwright/test').Page) =>
	page.getByPlaceholder("What's happening?").first();

test.describe('quality of life', () => {
	// `account` lives as long as the worker: leave it with nothing unread.
	test.afterEach(async ({ userApi }) => {
		await userApi.post(`${API_URL}/notifications/read`);
	});

	test.describe('composer', () => {
		test('Ctrl+Enter posts, and a toast says so with a link to the post', async ({
			userPage,
		}) => {
			await userPage.goto('/');
			await composer(userPage).fill('sent with the keyboard');
			await composer(userPage).press('Control+Enter');

			const toast = userPage.getByRole('status').filter({ hasText: 'Posted' });
			await expect(toast).toBeVisible();
			await expect(
				userPage.locator('article', { hasText: 'sent with the keyboard' }).first(),
			).toBeVisible();

			await toast.click();
			await expect(userPage).toHaveURL(/\/post\//);
		});

		test('the text is kept as a draft across a reload, and can be discarded', async ({
			userPage,
		}) => {
			await userPage.goto('/');
			await composer(userPage).fill('unfinished thought');
			await userPage.reload();

			await expect(composer(userPage)).toHaveValue('unfinished thought');
			const notice = userPage.getByRole('status').filter({ hasText: 'Draft restored' });
			await expect(notice).toBeVisible();

			await notice.getByRole('button', { name: 'Discard' }).click();
			await expect(composer(userPage)).toHaveValue('');
			await userPage.reload();
			await expect(composer(userPage)).toHaveValue('');
		});

		test('a character budget appears near the limit and blocks posting past it', async ({
			userPage,
		}) => {
			await userPage.goto('/');
			const post = userPage.getByRole('button', { name: 'Post', exact: true }).first();

			await composer(userPage).fill('short');
			await expect(userPage.getByLabel(/characters left/)).toHaveCount(0);

			await composer(userPage).fill('x'.repeat(1700));
			await expect(userPage.getByLabel('300 characters left')).toBeVisible();
			await expect(post).toBeEnabled();

			await composer(userPage).fill('x'.repeat(2050));
			await expect(userPage.getByLabel('-50 characters left')).toBeVisible();
			await expect(post).toBeDisabled();
			await composer(userPage).fill('');
		});
	});

	test.describe('posts', () => {
		test('[share] copies the link and says so', async ({ userPage, userApi }) => {
			await userPage.context().grantPermissions(['clipboard-read', 'clipboard-write']);
			const created = await (
				await userApi.post(`${API_URL}/posts`, { data: { content: 'share this one' } })
			).json();
			await userPage.goto(`/post/${created.post.postID}`);

			await userPage.getByRole('button', { name: '[share]' }).click();

			await expect(
				userPage.getByRole('status').filter({ hasText: 'Link copied' }),
			).toBeVisible();
			expect(await userPage.evaluate(() => navigator.clipboard.readText())).toBe(
				`${new URL(userPage.url()).origin}/post/${created.post.postID}`,
			);
		});

		test('a long post is folded in lists and open in full on its own page', async ({
			userPage,
			userApi,
		}) => {
			const lines = Array.from({ length: 12 }, (_, n) => `line ${n}`).join('\n');
			const created = await (
				await userApi.post(`${API_URL}/posts`, { data: { content: lines } })
			).json();

			await userPage.goto('/');
			const card = userPage.locator(`article[data-post-id="${created.post.postID}"]`);
			await card.getByRole('button', { name: 'show more' }).click();
			await expect(card.getByRole('button', { name: 'show less' })).toBeVisible();

			await userPage.goto(`/post/${created.post.postID}`);
			await expect(userPage.getByRole('button', { name: /show (more|less)/ })).toHaveCount(0);
		});

		test('a like turns into a counted, toggling button', async ({
			userPage,
			playwright,
			otherAccount,
		}) => {
			const author = await signIn(playwright, otherAccount);
			const created = await (
				await author.post(`${API_URL}/posts`, { data: { content: 'keyboard likes' } })
			).json();
			await author.dispose();

			await userPage.goto(`/post/${created.post.postID}`);
			await userPage.getByRole('button', { name: '[like]' }).click();
			await expect(userPage.getByRole('button', { name: '[unlike 1]' })).toBeVisible();
		});
	});

	test.describe('feed', () => {
		test('new posts from others are offered, not forced', async ({
			userPage,
			playwright,
			otherAccount,
		}) => {
			await userPage.goto('/');
			await expect(userPage.locator('article').first()).toBeVisible();

			const other = await signIn(playwright, otherAccount);
			await other.post(`${API_URL}/posts`, { data: { content: 'fresh from someone else' } });
			await other.dispose();

			// The poll runs every minute and when the tab becomes visible again; do the latter.
			await userPage.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
			const banner = userPage.getByRole('button', { name: /Show new posts: 1/ });
			await expect(banner).toBeVisible();

			await banner.click();
			await expect(
				userPage.locator('article', { hasText: 'fresh from someone else' }),
			).toBeVisible();
			await expect(banner).toHaveCount(0);
		});

		test('going back to the feed restores the scroll position', async ({
			userPage,
			userApi,
		}) => {
			for (let n = 0; n < 12; n++) {
				await userApi.post(`${API_URL}/posts`, { data: { content: `filler post ${n}` } });
			}

			await userPage.goto('/');
			await expect(userPage.locator('article').nth(8)).toBeVisible();
			await userPage.mouse.wheel(0, 1500);
			await expect.poll(() => userPage.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
			const before = await userPage.evaluate(() => window.scrollY);

			// A synthetic click: a real one would first scroll the link into view and move the page.
			await userPage
				.locator('article')
				.nth(6)
				.getByRole('link', { name: /^Post by/ })
				.dispatchEvent('click');
			await expect(userPage).toHaveURL(/\/post\//);
			await userPage.goBack();

			await expect(userPage.locator('article').first()).toBeVisible();
			await expect
				.poll(() => userPage.evaluate(() => window.scrollY))
				.toBeGreaterThan(before - 100);
		});
	});

	test.describe('keyboard', () => {
		test('j moves to a post, l likes it, ? lists the shortcuts, / goes to search', async ({
			userPage,
			userApi,
		}) => {
			await userApi.post(`${API_URL}/posts`, { data: { content: 'target of the keys' } });
			await userPage.goto('/');
			await expect(userPage.locator('article').first()).toBeVisible();

			await userPage.keyboard.press('j');
			const focused = userPage.locator('article:focus');
			await expect(focused).toHaveCount(1);

			await userPage.keyboard.press('l');
			await expect(focused.getByRole('button', { name: /\[unlike/i })).toBeVisible();

			await userPage.keyboard.press('?');
			await expect(
				userPage.getByRole('dialog', { name: 'Keyboard shortcuts' }),
			).toBeVisible();
			await userPage.keyboard.press('Escape');
			await expect(userPage.getByRole('dialog')).toHaveCount(0);

			await userPage.keyboard.press('/');
			await expect(userPage.getByRole('combobox', { name: 'Search' }).first()).toBeFocused();
		});

		test('shortcuts stay quiet while typing', async ({ userPage }) => {
			await userPage.goto('/');
			await composer(userPage).click();
			await userPage.keyboard.type('jkl?');

			await expect(composer(userPage)).toHaveValue('jkl?');
			await expect(userPage.getByRole('dialog')).toHaveCount(0);
			await composer(userPage).fill('');
		});
	});

	test.describe('live notices', () => {
		test('a follow shows a toast, the tab title counts it, and the toast leads to the follower', async ({
			userPage,
			account,
			otherAccount,
			playwright,
		}) => {
			// The live connection must be up before the follow, or the event is missed.
			const connected = userPage.waitForResponse((r) =>
				r.url().includes('/notifications/stream'),
			);
			await userPage.goto('/');
			await connected;
			await expect(userPage).toHaveTitle('Home · The Scroll');

			const other = await signIn(playwright, otherAccount);
			await other.put(`${API_URL}/users/${account.userName}/follow`);
			await other.dispose();

			const toast = userPage.getByRole('status').filter({
				hasText: `${otherAccount.userName} started following you`,
			});
			await expect(toast).toBeVisible();
			await expect(userPage).toHaveTitle('(1) Home · The Scroll');

			await toast.getByRole('button').first().click();
			await expect(userPage).toHaveURL(`/u/${otherAccount.userName}`);
		});

		test('the setting turns the pop-ups off, the counter still works', async ({
			userPage,
			account,
			otherAccount,
			playwright,
		}) => {
			await userPage.addInitScript(() =>
				window.localStorage.setItem('scroll:v1:toasts:events', 'false'),
			);
			await userPage.goto('/');
			const badge = userPage.locator('[data-testid=unread-badge]:visible');

			const other = await signIn(playwright, otherAccount);
			await other.put(`${API_URL}/users/${account.userName}/follow`);
			await other.dispose();

			await expect(badge).toHaveText('1');
			await expect(userPage.getByRole('status')).toHaveCount(0);
		});

		test('likes of one post from several people are one row', async ({
			userPage,
			userApi,
			playwright,
			otherAccount,
		}) => {
			const { createAccount, deleteAccount } = await import('../support/accounts');
			const third = await createAccount();
			const created = await (
				await userApi.post(`${API_URL}/posts`, { data: { content: 'liked by two' } })
			).json();

			try {
				for (const fan of [otherAccount, third]) {
					const api = await signIn(playwright, fan);
					await api.put(`${API_URL}/posts/${created.post.postID}/like`);
					await api.dispose();
				}

				await userPage.goto('/notifications');
				await expect(
					userPage.getByRole('link', { name: /and 1 more liked your post/ }),
				).toHaveCount(1);
			} finally {
				await deleteAccount(third);
			}
		});
	});

	test.describe('search and settings', () => {
		test('recent searches are offered in an empty box, and can be cleared', async ({
			userPage,
		}) => {
			await userPage.goto('/');
			const box = userPage.getByRole('combobox', { name: 'Search' }).first();

			await box.fill('zzqqrecent');
			await box.press('Enter');
			await expect(userPage).toHaveURL(/\/search\?q=zzqqrecent/);

			await userPage.goto('/');
			await box.click();
			await expect(userPage.getByRole('option', { name: 'zzqqrecent' })).toBeVisible();

			await userPage.getByRole('button', { name: 'Clear recent' }).click();
			await expect(userPage.getByRole('option', { name: 'zzqqrecent' })).toHaveCount(0);
		});

		test('leaving the profile editor with unsaved changes asks first', async ({ userPage }) => {
			await userPage.goto('/settings/profile');
			await userPage.getByPlaceholder('Display name').fill('Changed but not saved');

			await userPage.getByRole('button', { name: 'Back' }).click();
			const dialog = userPage.getByRole('dialog', { name: 'Leave without saving?' });
			await expect(dialog).toBeVisible();

			await dialog.getByRole('button', { name: 'Stay' }).click();
			await expect(userPage).toHaveURL('/settings/profile');

			await userPage.getByRole('button', { name: 'Back' }).click();
			await userPage.getByRole('dialog').getByRole('button', { name: 'Leave' }).click();
			await expect(userPage).not.toHaveURL('/settings/profile');
		});
	});
});
