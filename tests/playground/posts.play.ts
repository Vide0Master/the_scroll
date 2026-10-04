import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';

// A seeded corner of the app to click through by hand: `npm run play:posts`. It opens a visible
// browser signed in as a fresh test user with a few posts, and stops until you close the
// inspector; everything it created is removed afterwards.
test('posts playground', async ({ userPage, userApi, account, otherAccount }) => {
	test.setTimeout(0);

	const create = async (content: string, parentPostID?: string) =>
		(await (await userApi.post(`${API_URL}/posts`, { data: { content, parentPostID } })).json())
			.post as { postID: string };

	const first = await create(`A post to look at #playground @${otherAccount.userName}`);
	await create('A reply to it', first.postID);
	await create('A second post, no tags');

	console.log(`Signed in as ${account.userName} (password: ${account.password})`);
	console.log(`Another account exists too: ${otherAccount.userName}`);

	await userPage.goto('/');
	await expect(userPage.getByText('A post to look at')).toBeVisible();
	await userPage.pause();
});
