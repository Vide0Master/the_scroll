import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';
import { signIn } from '../support/session';

test.describe('infinite scroll', () => {
	test('a profile loads more posts when its end scrolls into view', async ({
		playwright,
		userPage,
		otherAccount,
	}) => {
		// A fresh account, so the count is exact; more than one page (30) of posts.
		const author = await signIn(playwright, otherAccount);

		try {
			for (let n = 0; n < 34; n++) {
				await author.post(`${API_URL}/posts`, { data: { content: `scroll post ${n}` } });
			}
		} finally {
			await author.dispose();
		}

		await userPage.goto(`/u/${otherAccount.userName}`);
		const cards = userPage.locator('article');
		await expect(cards).toHaveCount(30);

		await userPage.mouse.wheel(0, 100000);
		await expect(cards).toHaveCount(34);
	});
});
