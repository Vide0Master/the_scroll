import { randomUUID } from 'node:crypto';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';

const unique = () => randomUUID().slice(0, 8);

test.describe('hashtags in posts', () => {
	test('a hashtag is a link that opens the posts carrying it, not the post itself', async ({
		userPage,
		userApi,
	}) => {
		const tag = `t${unique()}`;
		const text = `e2e about #${tag} today`;
		await userApi.post(`${API_URL}/posts`, { data: { content: text } });
		await userPage.goto('/');

		const card = userPage.locator('article', { hasText: text });
		await card.getByRole('link', { name: `#${tag}` }).click();

		await expect(userPage).toHaveURL(`/hashtag/${tag}`);
		await expect(userPage.getByRole('heading', { name: `#${tag}` })).toBeVisible();
		await expect(userPage.locator('article', { hasText: text })).toBeVisible();
	});

	test('a tag nobody used says so', async ({ userPage }) => {
		await userPage.goto(`/hashtag/nobody${unique()}`);

		await expect(userPage.getByText('No posts with this hashtag yet.')).toBeVisible();
	});
});

test.describe('mentions in posts', () => {
	test('an @name of an existing account is a profile link, any other stays plain text', async ({
		userPage,
		userApi,
		otherAccount,
	}) => {
		const ghost = `nobody_${unique()}`;
		const text = `e2e hello @${otherAccount.userName} and @${ghost}`;
		await userApi.post(`${API_URL}/posts`, { data: { content: text } });
		await userPage.goto('/');

		const card = userPage.locator('article', { hasText: 'e2e hello' });
		await expect(card.getByRole('link', { name: `@${ghost}` })).toHaveCount(0);
		await expect(card).toContainText(`@${ghost}`);

		await card.getByRole('link', { name: `@${otherAccount.userName}` }).click();
		await expect(userPage).toHaveURL(`/u/${otherAccount.userName}`);
	});

	test('typing "@" offers matching accounts and picking one completes the name', async ({
		userPage,
		otherAccount,
	}) => {
		await userPage.goto('/');
		const editor = userPage.getByPlaceholder("What's happening?");

		await editor.pressSequentially(`hey @${otherAccount.userName.slice(0, 8)}`);
		const option = userPage.getByRole('option', { name: new RegExp(otherAccount.userName) });
		await expect(option).toBeVisible();

		await editor.press('Enter');

		await expect(editor).toHaveValue(`hey @${otherAccount.userName} `);
		await expect(userPage.getByRole('listbox')).toHaveCount(0);
	});

	test('Escape closes the hints without sending or changing the text', async ({
		userPage,
		otherAccount,
	}) => {
		await userPage.goto('/');
		const editor = userPage.getByPlaceholder("What's happening?");

		await editor.pressSequentially(`@${otherAccount.userName.slice(0, 8)}`);
		await expect(userPage.getByRole('listbox')).toBeVisible();

		await editor.press('Escape');

		await expect(userPage.getByRole('listbox')).toHaveCount(0);
		await expect(editor).toHaveValue(`@${otherAccount.userName.slice(0, 8)}`);
	});
});
