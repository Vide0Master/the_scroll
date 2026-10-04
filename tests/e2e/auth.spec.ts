import { expect, test } from '../support/fixtures';

test.describe('guest', () => {
	test('sees the feed and login/register actions instead of a user card', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByText('Log in to post and join the conversation.')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
	});

	test('the guest buttons open the login and register pages', async ({ page }) => {
		await page.goto('/');

		await page.getByRole('button', { name: 'Log in' }).click();
		await expect(page).toHaveURL(/\/auth\/login$/);

		await page.goto('/');
		await page.getByRole('button', { name: 'Create account' }).click();
		await expect(page).toHaveURL(/\/auth\/register$/);
	});
});

test.describe('login', () => {
	test('logs in and lands on the feed with the compose box', async ({ page, account }) => {
		await page.goto('/auth/login');

		await page.getByPlaceholder('Username or email').fill(account.userName);
		await page.getByPlaceholder('Password', { exact: true }).fill(account.password);
		await page.getByRole('button', { name: 'Login' }).click();

		await expect(page).toHaveURL('/');
		await expect(page.getByPlaceholder("What's happening?")).toBeVisible();
	});

	test('shows an error for a wrong password and stays on the page', async ({ page, account }) => {
		await page.goto('/auth/login');

		await page.getByPlaceholder('Username or email').fill(account.userName);
		await page.getByPlaceholder('Password', { exact: true }).fill('definitely-wrong');
		await page.getByRole('button', { name: 'Login' }).click();

		await expect(page.getByRole('alert')).toHaveText('Login or password is wrong');
		await expect(page).toHaveURL(/\/auth\/login$/);
	});

	test('validates short input before calling the server', async ({ page }) => {
		await page.goto('/auth/login');

		await page.getByPlaceholder('Username or email').fill('ab');
		await page.getByPlaceholder('Password', { exact: true }).fill('short');
		await page.getByRole('button', { name: 'Login' }).click();

		await expect(page.getByText('Enter at least 3 characters')).toBeVisible();
		await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
	});

	test('a logged-in session survives a reload', async ({ userPage }) => {
		await userPage.goto('/');
		await userPage.reload();

		await expect(userPage.getByPlaceholder("What's happening?")).toBeVisible();
	});
});

test.describe('registration form', () => {
	test('checks passwords and email before sending anything', async ({ page }) => {
		await page.goto('/auth/register');

		await page.getByPlaceholder('Username', { exact: true }).fill('e2e_form_check');
		await page.getByPlaceholder('Email').fill('not-an-email');
		await page.getByPlaceholder('Password', { exact: true }).fill('longenough1');
		await page.getByPlaceholder('Repeat password').fill('different-one');
		await page.getByRole('button', { name: 'Register' }).click();

		await expect(page.getByText('Enter a valid email')).toBeVisible();
		await expect(page.getByText('Passwords do not match')).toBeVisible();
	});

	test('flags a username that is already taken', async ({ page, account }) => {
		await page.goto('/auth/register');

		await page.getByPlaceholder('Username', { exact: true }).fill(account.userName);
		await page.getByPlaceholder('Email').click();

		await expect(page.getByText('This username is already taken')).toBeVisible();
	});
});
