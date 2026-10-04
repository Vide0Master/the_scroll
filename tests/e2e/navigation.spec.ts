import { expect, test } from '../support/fixtures';

test.describe('navigation', () => {
	test('the side navigation moves between home and settings', async ({ userPage }) => {
		await userPage.goto('/');

		await userPage.getByRole('link', { name: 'Settings' }).first().click();
		await expect(userPage).toHaveURL('/settings');
		await expect(userPage.getByRole('heading', { name: 'Settings' })).toBeVisible();

		await userPage.getByRole('link', { name: 'Home' }).first().click();
		await expect(userPage).toHaveURL('/');
	});

	test('unfinished sections are disabled instead of made-up', async ({ userPage }) => {
		await userPage.goto('/');

		// Messages has nothing behind it yet.
		await expect(
			userPage.locator('span[aria-disabled=true]', { hasText: 'Messages' }),
		).toHaveCount(1);
	});

	test('the Following feed needs an account', async ({ page, userPage }) => {
		await page.goto('/');
		await expect(page.getByRole('tab', { name: 'Following' })).toBeDisabled();

		await userPage.goto('/');
		await expect(userPage.getByRole('tab', { name: 'Following' })).toBeEnabled();
	});
});
