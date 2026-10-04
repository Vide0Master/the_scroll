import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';

test.describe('like button', () => {
	test('the like button toggles and keeps its count after a reload', async ({
		userPage,
		userApi,
	}) => {
		const created = await (
			await userApi.post(`${API_URL}/posts`, { data: { content: 'e2e like target' } })
		).json();
		await userPage.goto(`/post/${created.post.postID}`);
		const like = userPage.getByRole('button', { name: /\[like/i });

		await like.click();
		await expect(userPage.getByRole('button', { name: '[Unlike 1]' })).toBeVisible();

		await userPage.reload();
		await expect(userPage.getByRole('button', { name: '[Unlike 1]' })).toBeVisible();

		await userPage.getByRole('button', { name: '[Unlike 1]' }).click();
		await expect(userPage.getByRole('button', { name: /\[like\]/i })).toBeVisible();
	});
});
