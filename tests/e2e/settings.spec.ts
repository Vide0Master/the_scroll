import type { Page } from '@playwright/test';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';

const background = (page: Page) =>
	page.evaluate(() =>
		getComputedStyle(document.documentElement).getPropertyValue('--theme-surface').trim(),
	);

const LIGHT_BACKGROUND = '#ffffff';

test.describe('themes as a guest', () => {
	test('switching the theme applies at once and survives a reload', async ({ page }) => {
		await page.goto('/settings/theme');
		await expect(
			page.getByText('Log in to keep your themes on all your devices.'),
		).toBeVisible();
		const darkBackground = await background(page);

		await page.getByRole('button', { name: 'Light', exact: true }).click();
		await expect.poll(() => background(page)).toBe(LIGHT_BACKGROUND);

		await page.reload();
		await expect(page.getByRole('button', { name: 'Light', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		expect(await background(page)).toBe(LIGHT_BACKGROUND);
		expect(darkBackground).not.toBe(LIGHT_BACKGROUND);
	});
});

test.describe('themes with an account', () => {
	test('the choice is saved to the account', async ({ userPage, userApi }) => {
		await userPage.goto('/settings/theme');

		await userPage.getByRole('button', { name: 'Winter', exact: true }).click();

		await expect
			.poll(
				async () =>
					(await (await userApi.get(`${API_URL}/users/me/settings`)).json()).settings
						.themeId,
			)
			.toBe('winter');
	});

	test('a saved theme is applied on a fresh device (no local cache)', async ({
		userApi,
		browser,
		baseURL,
	}) => {
		await userApi.put(`${API_URL}/users/me/settings`, {
			data: { themeId: 'light', customThemes: [] },
		});

		const context = await browser.newContext({
			baseURL,
			storageState: await userApi.storageState(),
		});
		const page = await context.newPage();
		await page.goto('/');

		await expect.poll(() => background(page)).toBe(LIGHT_BACKGROUND);
		await context.close();
	});

	test('creates a custom theme and selects it', async ({ userPage, userApi }) => {
		await userPage.goto('/settings/theme');

		await userPage.getByRole('button', { name: 'Create your own' }).click();
		const dialog = userPage.getByRole('dialog', { name: 'New theme' });
		await dialog.getByLabel('Theme name').fill('E2E Theme');
		await dialog.getByRole('button', { name: 'Save' }).click();

		await expect(dialog).toHaveCount(0);
		await expect(userPage.getByRole('button', { name: 'E2E Theme' })).toBeVisible();

		// Saved to the account in the background, so wait for it instead of reading once.
		await expect
			.poll(async () => {
				const { settings } = await (
					await userApi.get(`${API_URL}/users/me/settings`)
				).json();
				return settings.customThemes.map((theme: { name: string }) => theme.name);
			})
			.toContain('E2E Theme');
	});
});
