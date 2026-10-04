import { randomUUID } from 'node:crypto';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';
import { signIn } from '../support/session';

test.describe('live notifications', () => {
	test('a red counter appears by the bell without reloading, and clears only when the notification is opened', async ({
		userPage,
		account,
		otherAccount,
		playwright,
	}) => {
		await userPage.goto('/');
		const badge = userPage.locator('[data-testid=unread-badge]:visible');
		await expect(userPage.getByPlaceholder("What's happening?")).toBeVisible();
		await expect(badge).toHaveCount(0);

		const other = await signIn(playwright, otherAccount);
		await other.put(`${API_URL}/users/${account.userName}/follow`);
		await other.dispose();

		// No reload: it comes over the live connection.
		await expect(badge).toHaveText('1');

		await userPage.getByRole('link', { name: 'Notifications' }).click();
		await expect(userPage).toHaveURL('/notifications');
		const row = userPage.getByRole('link', {
			name: `${otherAccount.userName} started following you`,
		});
		await expect(row).toBeVisible();
		// Looking at the list is not reading: it stays unread until it is opened.
		await expect(badge).toHaveText('1');

		await row.click();
		await expect(userPage).toHaveURL(`/u/${otherAccount.userName}`);
		await expect(badge).toHaveCount(0);
	});

	test('a notification that arrives while the list is open is added to it', async ({
		userPage,
		account,
		otherAccount,
		playwright,
	}) => {
		await userPage.goto('/notifications');
		await expect(userPage.getByText('Nothing here yet.')).toBeVisible();

		const other = await signIn(playwright, otherAccount);
		const post = (
			await (
				await other.post(`${API_URL}/posts`, { data: { content: 'e2e for you' } })
			).json()
		).post;
		void post;
		await other.post(`${API_URL}/posts`, {
			data: { content: `e2e hi @${account.userName}` },
		});
		await other.dispose();

		await expect(
			userPage.getByText(`${otherAccount.userName} mentioned you in a post`),
		).toBeVisible();
		// It arrived while the list is open, and is still unread until dealt with.
		const badge = userPage.locator('[data-testid=unread-badge]:visible');
		await expect(badge).toHaveText('1');

		await userPage.getByRole('button', { name: 'Mark all as read' }).click();
		await expect(badge).toHaveCount(0);
	});

	test('a guest has no live bell', async ({ page }) => {
		await page.goto('/');

		await expect(page.locator('[data-testid=unread-badge]:visible')).toHaveCount(0);
		await page.goto('/notifications');
		await expect(page.getByText('Log in to see your notifications.')).toBeVisible();
	});
});

test.describe('following on a profile', () => {
	test('the Follow button follows, updates the numbers, and survives a reload', async ({
		userPage,
		otherAccount,
	}) => {
		await userPage.goto(`/u/${otherAccount.userName}`);
		const followers = userPage.getByText(/^Followers$/).locator('xpath=preceding-sibling::b');
		await expect(followers).toHaveText('0');

		await userPage
			.getByRole('main')
			.getByRole('button', { name: 'Follow', exact: true })
			.click();
		await expect(userPage.getByRole('button', { name: 'Unfollow' })).toBeVisible();
		await expect(followers).toHaveText('1');

		await userPage.reload();
		await expect(userPage.getByRole('button', { name: 'Unfollow' })).toBeVisible();

		await userPage.getByRole('button', { name: 'Unfollow' }).click();
		await expect(
			userPage.getByRole('main').getByRole('button', { name: 'Follow', exact: true }),
		).toBeVisible();
		await expect(followers).toHaveText('0');
	});

	test('the Following tab shows only followed accounts', async ({
		userPage,
		userApi,
		otherAccount,
		playwright,
	}) => {
		const text = `e2e followed post ${randomUUID().slice(0, 8)}`;
		const other = await signIn(playwright, otherAccount);
		await other.post(`${API_URL}/posts`, { data: { content: text } });
		await other.dispose();
		await userApi.put(`${API_URL}/users/${otherAccount.userName}/follow`);

		await userPage.goto('/');
		await userPage.getByRole('tab', { name: 'Following' }).click();

		await expect(userPage.locator('article', { hasText: text })).toBeVisible();
		await expect(userPage.locator('article')).toHaveCount(1);
		await userApi.delete(`${API_URL}/users/${otherAccount.userName}/follow`);
	});
});
