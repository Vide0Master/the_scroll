import type { APIRequestContext } from '@playwright/test';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';
import { signIn } from '../support/session';

interface Notification {
	type: string;
	postID: string | null;
	actor: { userName: string } | null;
}

async function list(api: APIRequestContext) {
	return (
		(await (await api.get(`${API_URL}/notifications`)).json()) as {
			notifications: Notification[];
		}
	).notifications;
}

const likeUrl = (postID: string) => `${API_URL}/posts/${postID}/like`;

// Sending is best effort and not awaited by the like request, so give it a moment.
async function likeNotifications(api: APIRequestContext, postID: string, expected: number) {
	await expect
		.poll(
			async () =>
				(await list(api)).filter((n) => n.type === 'LIKE' && n.postID === postID).length,
		)
		.toBe(expected);
}

test.describe('like notifications', () => {
	test('a like notifies the author once, even after unlike and like again', async ({
		playwright,
		userApi,
		otherAccount,
	}) => {
		const post = (
			await (await userApi.post(`${API_URL}/posts`, { data: { content: 'like me' } })).json()
		).post as { postID: string };
		const fan = await signIn(playwright, otherAccount);

		try {
			await fan.put(likeUrl(post.postID));
			await likeNotifications(userApi, post.postID, 1);

			await fan.delete(likeUrl(post.postID));
			await fan.put(likeUrl(post.postID));
			// Still unread: not repeated.
			await new Promise((resolve) => setTimeout(resolve, 500));
			await likeNotifications(userApi, post.postID, 1);

			const [like] = (await list(userApi)).filter((n) => n.postID === post.postID);
			expect(like.actor?.userName).toBe(otherAccount.userName);
		} finally {
			await fan.dispose();
			await userApi.post(`${API_URL}/notifications/read`);
		}
	});

	test('liking your own post notifies nobody', async ({ userApi }) => {
		const post = (
			await (await userApi.post(`${API_URL}/posts`, { data: { content: 'my own' } })).json()
		).post as { postID: string };

		await userApi.put(likeUrl(post.postID));
		await new Promise((resolve) => setTimeout(resolve, 500));

		expect((await list(userApi)).filter((n) => n.postID === post.postID)).toHaveLength(0);
	});
});
