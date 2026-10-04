import type { Page } from '@playwright/test';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';
import { removeUploaded, transparentAvatar } from '../support/media';

const empty = { visibleName: null, avatarUrl: null, bannerUrl: null, bannerGradient: null };

/** Alpha of the top-left pixel of an image, read through a canvas in the browser. */
async function cornerAlpha(page: Page, src: string): Promise<number> {
	return page.evaluate(async (url) => {
		const image = new Image();
		image.src = url;
		await image.decode();
		const canvas = document.createElement('canvas');
		canvas.width = image.naturalWidth;
		canvas.height = image.naturalHeight;
		const context = canvas.getContext('2d')!;
		context.drawImage(image, 0, 0);
		return context.getImageData(1, 1, 1, 1).data[3];
	}, src);
}

async function uploadAvatar(page: Page) {
	await page.getByLabel('Upload avatar').setInputFiles({
		name: 'avatar.png',
		mimeType: 'image/png',
		buffer: transparentAvatar,
	});
	const dialog = page.getByRole('dialog', { name: 'Crop avatar' });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Apply' }).click();
	await expect(dialog).toHaveCount(0);
}

test.describe('settings menu', () => {
	test('/settings is a list of sections; a section takes over the panel', async ({
		userPage,
	}) => {
		await userPage.goto('/settings');

		await expect(userPage.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
		const menu = userPage.getByRole('navigation', { name: 'Settings' });
		await expect(menu.getByRole('link')).toHaveText(['My profile', 'Theme', 'Notifications']);

		await menu.getByRole('link', { name: 'Theme' }).click();

		await expect(userPage).toHaveURL('/settings/theme');
		await expect(userPage.getByRole('heading', { name: 'Theme', level: 1 })).toBeVisible();
		await expect(userPage.getByText('Built-in themes')).toBeVisible();
		// The menu is gone: the section owns the whole panel.
		await expect(menu).toHaveCount(0);
	});

	test('the back button returns to the menu', async ({ userPage }) => {
		await userPage.goto('/settings');
		await userPage.getByRole('link', { name: 'My profile' }).click();
		await expect(userPage).toHaveURL('/settings/profile');

		await userPage.getByRole('button', { name: 'Back' }).click();

		await expect(userPage).toHaveURL('/settings');
		await expect(userPage.getByRole('link', { name: 'Theme' })).toBeVisible();
	});

	test('the browser back and forward buttons move between the menu and a section', async ({
		userPage,
	}) => {
		await userPage.goto('/settings');
		await userPage.getByRole('link', { name: 'Theme' }).click();
		await expect(userPage).toHaveURL('/settings/theme');

		await userPage.goBack();
		await expect(userPage).toHaveURL('/settings');
		await expect(userPage.getByRole('link', { name: 'My profile' })).toBeVisible();

		await userPage.goForward();
		await expect(userPage).toHaveURL('/settings/theme');
		await expect(userPage.getByRole('heading', { name: 'Theme', level: 1 })).toBeVisible();
	});

	test('a section opened by address goes back to the menu, not out of the app', async ({
		userPage,
	}) => {
		await userPage.goto('/settings/profile');

		await userPage.getByRole('button', { name: 'Back' }).click();

		await expect(userPage).toHaveURL('/settings');
	});

	test('a guest is asked to log in instead of getting the editor', async ({ page }) => {
		await page.goto('/settings/profile');

		await expect(page.getByText('Log in to edit your profile.')).toBeVisible();
	});
});

test.describe('profile editor', () => {
	test.afterEach(async ({ userApi }) => {
		const { userData } = await (await userApi.get(`${API_URL}/users/me`)).json();
		await removeUploaded([userData.avatarUrl, userData.bannerUrl].filter(Boolean));
		await userApi.put(`${API_URL}/users/me/profile`, { data: empty });
	});

	test('changes the display name, shown on the profile and in the preview', async ({
		userPage,
		account,
	}) => {
		await userPage.goto('/settings/profile');

		await userPage.getByPlaceholder('Display name').fill('E2E Display');
		await expect(userPage.getByRole('region', { name: 'Preview' })).toContainText(
			'E2E Display',
		);
		await userPage.getByRole('button', { name: 'Save profile' }).click();
		await expect(userPage.getByRole('status')).toHaveText('Profile saved.');

		await userPage.goto(`/u/${account.userName}`);
		await expect(
			userPage.getByRole('heading', { name: 'E2E Display', level: 2 }),
		).toBeVisible();
	});

	test('crops and uploads a transparent avatar that keeps its transparency', async ({
		userPage,
		userApi,
		account,
	}) => {
		await userPage.goto('/settings/profile');
		await uploadAvatar(userPage);
		await userPage.getByRole('button', { name: 'Save profile' }).click();
		await expect(userPage.getByRole('status')).toHaveText('Profile saved.');

		const { userData } = await (await userApi.get(`${API_URL}/users/me`)).json();
		expect(userData.avatarUrl).toMatch(/^\/api\/media\/file\/[0-9a-f-]{36}\.png$/);
		// The corner of the round cut-out is fully transparent in the stored file.
		expect(await cornerAlpha(userPage, userData.avatarUrl)).toBe(0);

		await userPage.goto(`/u/${account.userName}`);
		await expect(userPage.locator(`img[src="${userData.avatarUrl}"]`).first()).toBeVisible();
	});

	test('the avatar appears on the account’s posts in the feed', async ({ userPage, userApi }) => {
		await userPage.goto('/settings/profile');
		await uploadAvatar(userPage);
		await userPage.getByRole('button', { name: 'Save profile' }).click();
		await expect(userPage.getByRole('status')).toHaveText('Profile saved.');
		const { userData } = await (await userApi.get(`${API_URL}/users/me`)).json();

		await userApi.post(`${API_URL}/posts`, { data: { content: 'e2e avatar in feed' } });
		await userPage.goto('/');

		const card = userPage.locator('article', { hasText: 'e2e avatar in feed' });
		await expect(card.locator(`img[src="${userData.avatarUrl}"]`)).toBeVisible();
	});

	test('builds gradient choices from the avatar and saves the picked one', async ({
		userPage,
		userApi,
		account,
	}) => {
		await userPage.goto('/settings/profile');
		await userPage.getByRole('button', { name: 'Gradient from avatar' }).click();
		await expect(
			userPage.getByText('Upload an avatar with visible colors to build gradients from it.'),
		).toBeVisible();

		await uploadAvatar(userPage);
		const choices = userPage.getByRole('group', { name: 'Gradients based on your avatar' });
		await expect(choices.getByRole('button')).not.toHaveCount(0);

		await choices.getByRole('button', { name: 'Gradient 1' }).click();
		await expect(choices.getByRole('button', { name: 'Gradient 1' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		await userPage.getByRole('button', { name: 'Save profile' }).click();
		await expect(userPage.getByRole('status')).toHaveText('Profile saved.');

		const { userData } = await (await userApi.get(`${API_URL}/users/me`)).json();
		expect(userData.bannerUrl).toBeNull();
		expect(userData.bannerGradient).toEqual({
			from: expect.stringMatching(/^#[0-9a-f]{6}$/),
			to: expect.stringMatching(/^#[0-9a-f]{6}$/),
		});

		await userPage.goto(`/u/${account.userName}`);
		await expect(userPage.getByTestId('banner-gradient')).toBeVisible();
	});

	test('removing the avatar brings back the letter placeholder', async ({
		userPage,
		userApi,
	}) => {
		await userApi.put(`${API_URL}/users/me/profile`, {
			data: {
				...empty,
				avatarUrl: '/api/media/file/11111111-2222-4333-8444-555555555555.png',
			},
		});
		await userPage.goto('/settings/profile');

		await userPage.getByRole('button', { name: 'Remove avatar' }).click();
		await userPage.getByRole('button', { name: 'Save profile' }).click();
		await expect(userPage.getByRole('status')).toHaveText('Profile saved.');

		const { userData } = await (await userApi.get(`${API_URL}/users/me`)).json();
		expect(userData.avatarUrl).toBeNull();
	});

	test('rejects a file bigger than the client limit before uploading', async ({ userPage }) => {
		await userPage.goto('/settings/profile');

		await userPage.getByLabel('Upload avatar').setInputFiles({
			name: 'huge.png',
			mimeType: 'image/png',
			buffer: Buffer.alloc(11 * 1024 * 1024),
		});

		await expect(userPage.getByRole('alert')).toContainText('larger than 10MB');
		await expect(userPage.getByRole('dialog')).toHaveCount(0);
	});
});
