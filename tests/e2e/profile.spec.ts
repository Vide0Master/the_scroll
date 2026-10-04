import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';

test.describe('profile', () => {
	test('shows the account, its posts and the disabled mock actions', async ({
		page,
		userApi,
		account,
	}) => {
		await userApi.post(`${API_URL}/posts`, { data: { content: 'e2e on my profile' } });

		await page.goto(`/u/${account.userName}`);

		await expect(page.getByRole('heading', { name: account.userName, level: 2 })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Posts' })).toHaveAttribute(
			'aria-selected',
			'true',
		);
		await expect(page.locator('article', { hasText: 'e2e on my profile' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Replies' })).toBeEnabled();
		await expect(page.getByRole('tab', { name: 'Likes' })).toBeDisabled();
	});

	test('the Media tab is empty for an account without media', async ({ page, otherAccount }) => {
		await page.goto(`/u/${otherAccount.userName}`);
		await page.getByRole('tab', { name: 'Media' }).click();

		await expect(page.getByText('No photos or videos yet.')).toBeVisible();
	});

	test('the Media tab lists images from posts', async ({ page, userApi, account }) => {
		await userApi.post(`${API_URL}/posts`, {
			data: { content: 'with media', mediaUrls: ['/api/media/file/e2e-missing.png'] },
		});

		await page.goto(`/u/${account.userName}`);
		await page.getByRole('tab', { name: 'Media' }).click();

		await expect(page.getByRole('button', { name: /^View image/ }).first()).toBeVisible();
	});

	test('tells the visitor when the account does not exist', async ({ page }) => {
		await page.goto('/u/e2e_no_such_user');

		await expect(page.getByText("This account doesn't exist")).toBeVisible();
	});

	test('the profile link in the navigation leads to the own profile', async ({
		userPage,
		account,
	}) => {
		await userPage.goto('/');
		await userPage.getByRole('link', { name: 'Profile' }).first().click();

		await expect(userPage).toHaveURL(`/u/${account.userName}`);
	});
});
