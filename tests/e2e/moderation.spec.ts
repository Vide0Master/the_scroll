import { randomUUID } from 'node:crypto';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';
import { setRoles, signIn } from '../support/session';

// `account` lives as long as the worker: roles given to it must not leak into other tests.
test.afterEach(async ({ account }) => {
	await setRoles(account, []);
});

test.describe('admin panel', () => {
	test('a regular user has no Admin link and gets a notice at /admin', async ({ userPage }) => {
		await userPage.goto('/');
		await expect(userPage.getByPlaceholder("What's happening?")).toBeVisible();
		await expect(userPage.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0);

		await userPage.goto('/admin');

		await expect(
			userPage.getByText('This section is for moderators and admins.'),
		).toBeVisible();
	});

	test('a moderator finds an account, blocks it and unblocks it again', async ({
		userPage,
		account,
		otherAccount,
	}) => {
		await setRoles(account, ['MODERATOR']);
		await userPage.goto('/');
		await userPage.getByRole('link', { name: 'Admin', exact: true }).click();
		await expect(userPage).toHaveURL('/admin');
		await userPage.getByRole('link', { name: 'Accounts' }).click();

		await userPage.getByPlaceholder('Search by name').fill(otherAccount.userName);
		// Wait for the list to narrow down to the searched account before acting on it.
		await expect(userPage.getByRole('button', { name: 'Block', exact: true })).toHaveCount(1);
		await expect(userPage.locator('main').getByText(`@${otherAccount.userName}`)).toBeVisible();
		await userPage.getByRole('button', { name: 'Block', exact: true }).click();
		const dialog = userPage.getByRole('dialog');
		await dialog.getByPlaceholder('Reason (optional, kept for the record)').fill('e2e abuse');
		await dialog.getByRole('button', { name: 'Block', exact: true }).click();
		await expect(dialog).toHaveCount(0);
		await expect(
			userPage
				.getByRole('status')
				.filter({ hasText: `@${otherAccount.userName} was blocked` }),
		).toBeVisible();

		// It moved to the "Blocked" tab, with the reason.
		await userPage.getByRole('button', { name: 'Back' }).click();
		await userPage.getByRole('link', { name: 'Blocked' }).click();
		await userPage.getByPlaceholder('Search by name').fill(otherAccount.userName);
		await expect(userPage.getByText('Reason: e2e abuse')).toBeVisible();
		await expect(userPage.locator('main').getByText(`@${otherAccount.userName}`)).toBeVisible();

		const profile = await userPage.request.get(`${API_URL}/users/${otherAccount.userName}`);
		expect((await profile.json()).userData.isBanned).toBe(true);

		await userPage.getByRole('button', { name: 'Unblock', exact: true }).click();
		await userPage
			.getByRole('dialog')
			.getByRole('button', { name: 'Unblock', exact: true })
			.click();
		await expect(userPage.locator('main').getByText(`@${otherAccount.userName}`)).toHaveCount(
			0,
		);
	});

	test('a blocked profile carries a mark', async ({
		userPage,
		account,
		otherAccount,
		playwright,
	}) => {
		await setRoles(account, ['MODERATOR']);
		const moderator = await signIn(playwright, account);
		await moderator.post(`${API_URL}/users/admin/users/${otherAccount.userName}/ban`);
		await moderator.dispose();

		await userPage.goto(`/u/${otherAccount.userName}`);

		await expect(userPage.getByText('Blocked', { exact: true })).toBeVisible();
	});
});

test.describe('removing a post from its card', () => {
	test('a moderator removes another user’s post and sees the placeholder; own posts have no [Remove]', async ({
		userPage,
		userApi,
		account,
		otherAccount,
		playwright,
	}) => {
		const text = `e2e remove me ${randomUUID().slice(0, 8)}`;
		const other = await signIn(playwright, otherAccount);
		await other.post(`${API_URL}/posts`, { data: { content: text } });
		await other.dispose();
		await userApi.post(`${API_URL}/posts`, { data: { content: 'e2e my own post' } });
		await setRoles(account, ['MODERATOR']);
		await userPage.goto('/');

		await expect(
			userPage
				.locator('article', { hasText: 'e2e my own post' })
				.getByRole('button', { name: '[Remove]' }),
		).toHaveCount(0);

		await userPage
			.locator('article', { hasText: text })
			.getByRole('button', { name: '[Remove]' })
			.click();
		await userPage
			.getByRole('dialog')
			.getByRole('button', { name: 'Remove', exact: true })
			.click();

		await expect(userPage.getByText('This post was removed by a moderator.')).toBeVisible();
		await expect(userPage.getByText(text)).toHaveCount(0);
	});

	test('a regular user sees no [Remove] on other people’s posts', async ({
		userPage,
		otherAccount,
		playwright,
	}) => {
		const text = `e2e not removable ${randomUUID().slice(0, 8)}`;
		const other = await signIn(playwright, otherAccount);
		await other.post(`${API_URL}/posts`, { data: { content: text } });
		await other.dispose();
		await userPage.goto('/');

		const card = userPage.locator('article', { hasText: text });
		await expect(card).toBeVisible();
		await expect(card.getByRole('button', { name: '[Remove]' })).toHaveCount(0);
	});
});
