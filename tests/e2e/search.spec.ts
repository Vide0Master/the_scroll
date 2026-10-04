import { randomUUID } from 'node:crypto';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';
import { signIn } from '../support/session';

const word = () =>
	`zq${
		randomUUID()
			.replace(/[^a-f]/g, '')
			.slice(0, 8) || 'abcdef'
	}x`;

test.describe('search box', () => {
	test('offers matching people and hashtags, and a hint opens its page', async ({
		userPage,
		userApi,
		otherAccount,
	}) => {
		const tag = word();
		await userApi.post(`${API_URL}/posts`, { data: { content: `e2e about #${tag}` } });
		await userPage.goto('/');
		const box = userPage.getByRole('combobox', { name: 'Search' }).first();

		await box.fill(otherAccount.userName.slice(0, 9));
		await userPage.getByRole('option', { name: new RegExp(otherAccount.userName) }).click();
		await expect(userPage).toHaveURL(`/u/${otherAccount.userName}`);

		await box.fill(`#${tag.slice(0, 6)}`);
		await expect(userPage.getByRole('option', { name: new RegExp(`#${tag}`) })).toBeVisible();
		await userPage.getByRole('option', { name: new RegExp(`#${tag}`) }).click();
		await expect(userPage).toHaveURL(`/hashtag/${tag}`);
	});

	test('the keyboard picks a hint, and Enter without one runs the full search', async ({
		userPage,
		userApi,
	}) => {
		const w = word();
		await userApi.post(`${API_URL}/posts`, { data: { content: `e2e keyword ${w} here` } });
		await userPage.goto('/');
		const box = userPage.getByRole('combobox', { name: 'Search' }).first();

		await box.fill(w);
		await expect(userPage.getByRole('option', { name: /Search for/ })).toBeVisible();
		await box.press('Enter');

		await expect(userPage).toHaveURL(`/search?q=${w}`);
		await expect(userPage.locator('article', { hasText: `keyword ${w}` })).toBeVisible();

		await box.fill('x');
		await box.press('Escape');
		await expect(userPage.getByRole('listbox')).toHaveCount(0);
	});
});

test.describe('search page', () => {
	test('shows posts, people and hashtags of a query on their tabs', async ({
		userPage,
		userApi,
		otherAccount,
		playwright,
	}) => {
		const w = word();
		const other = await signIn(playwright, otherAccount);
		await other.post(`${API_URL}/posts`, { data: { content: `e2e find #${w}` } });
		await other.dispose();
		await userApi.post(`${API_URL}/posts`, { data: { content: `e2e plain ${w}` } });

		await userPage.goto(`/search?q=${w}`);
		await expect(userPage.locator('article')).toHaveCount(2);

		await userPage.getByRole('tab', { name: 'Hashtags' }).click();
		await expect(userPage).toHaveURL(`/search?q=${w}&tab=tags`);
		await expect(userPage.getByRole('link', { name: new RegExp(`#${w}`) })).toBeVisible();

		await userPage.getByRole('tab', { name: 'People' }).click();
		await expect(userPage.getByText(`No people found for "${w}".`)).toBeVisible();

		await userPage.goto(`/search?q=${otherAccount.userName.slice(2, 10)}&tab=people`);
		await expect(userPage.getByText(`@${otherAccount.userName}`).first()).toBeVisible();
	});

	test('explains an empty query and one with nothing searchable; Explore leads here', async ({
		userPage,
	}) => {
		await userPage.goto('/');
		await userPage.getByRole('link', { name: 'Explore' }).first().click();
		await expect(userPage).toHaveURL('/search');
		await expect(
			userPage.getByText('Type a word, a #hashtag or a name to search.'),
		).toBeVisible();

		await userPage.goto('/search?q=a');
		await expect(
			userPage.getByText('Type at least one word (2+ letters) or a #hashtag.'),
		).toBeVisible();
	});

	test('works for a guest', async ({ page, userApi }) => {
		const w = word();
		await userApi.post(`${API_URL}/posts`, { data: { content: `e2e for guests ${w}` } });

		await page.goto(`/search?q=${w}`);

		await expect(page.locator('article', { hasText: `for guests ${w}` })).toBeVisible();
	});
});
