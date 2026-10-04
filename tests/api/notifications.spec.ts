import type { APIRequestContext } from '@playwright/test';
import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';
import { internalHeaders } from '../support/internal';
import { signIn } from '../support/session';
import { SERVICE_PORTS } from '../support/env';

const notificationsUrl = `${API_URL}/notifications`;
const followUrl = (userName: string) => `${API_URL}/users/${userName}/follow`;

interface Notification {
	type: string;
	postID: string | null;
	isRead: boolean;
	actor: { userName: string } | null;
}

async function list(api: APIRequestContext) {
	return (await (await api.get(notificationsUrl)).json()) as {
		notifications: Notification[];
		unreadCount: number;
	};
}

test.describe('notifications', () => {
	test('a follow notifies the person followed, once while it is unread', async ({
		userApi,
		account,
		otherAccount,
		playwright,
	}) => {
		const other = await signIn(playwright, otherAccount);

		await userApi.put(followUrl(otherAccount.userName));
		await userApi.delete(followUrl(otherAccount.userName));
		await userApi.put(followUrl(otherAccount.userName));

		const { notifications, unreadCount } = await list(other);
		await other.dispose();

		expect(unreadCount).toBe(1);
		expect(notifications).toHaveLength(1);
		expect(notifications[0]).toMatchObject({
			type: 'FOLLOW',
			isRead: false,
			postID: null,
			actor: { userName: account.userName },
		});
		await userApi.delete(followUrl(otherAccount.userName));
	});

	test('reading can mark just the chosen notifications, and only your own', async ({
		userApi,
		account,
		otherAccount,
		playwright,
	}) => {
		const other = await signIn(playwright, otherAccount);
		await userApi.put(followUrl(otherAccount.userName));
		const mine = (await list(other)).notifications;
		expect(mine).toHaveLength(1);
		const [{ id }] = mine as unknown as { id: string }[];

		// Someone else's notification id changes nothing.
		await userApi.post(`${notificationsUrl}/read`, { data: { ids: [id] } });
		expect((await list(other)).unreadCount).toBe(1);

		const answer = await (
			await other.post(`${notificationsUrl}/read`, { data: { ids: [id] } })
		).json();
		expect(answer.unreadCount).toBe(0);
		expect((await list(other)).notifications[0].isRead).toBe(true);

		expect(
			(await other.post(`${notificationsUrl}/read`, { data: { ids: 'nope' } })).status(),
		).toBe(400);
		await other.dispose();
		await userApi.delete(followUrl(otherAccount.userName));
		void account;
	});

	test('reading marks everything read', async ({ userApi, otherAccount, playwright }) => {
		const other = await signIn(playwright, otherAccount);
		await userApi.put(followUrl(otherAccount.userName));

		const read = await other.post(`${notificationsUrl}/read`);
		const after = await list(other);
		await other.dispose();

		expect(read.status()).toBe(200);
		expect(after.unreadCount).toBe(0);
		expect(after.notifications[0].isRead).toBe(true);
		await userApi.delete(followUrl(otherAccount.userName));
	});

	test('a reply notifies the author of the post, a mention the account mentioned', async ({
		userApi,
		account,
		otherAccount,
		playwright,
	}) => {
		const other = await signIn(playwright, otherAccount);
		const original = (
			await (
				await other.post(`${API_URL}/posts`, { data: { content: 'e2e original' } })
			).json()
		).post;

		const reply = (
			await (
				await userApi.post(`${API_URL}/posts`, {
					data: { content: 'e2e answering', parentPostID: original.postID },
				})
			).json()
		).post;
		const mention = (
			await (
				await userApi.post(`${API_URL}/posts`, {
					data: { content: `e2e hello @${otherAccount.userName}` },
				})
			).json()
		).post;

		// Sent after the response, so give it a moment.
		await expect
			.poll(async () => (await list(other)).notifications.length, { timeout: 10_000 })
			.toBe(2);
		const { notifications } = await list(other);
		await other.dispose();

		expect(notifications).toContainEqual(
			expect.objectContaining({
				type: 'REPLY',
				postID: reply.postID,
				actor: expect.objectContaining({ userName: account.userName }),
			}),
		);
		expect(notifications).toContainEqual(
			expect.objectContaining({ type: 'MENTION', postID: mention.postID }),
		);
	});

	test('a reply that also mentions its addressee notifies once, and nothing goes to oneself', async ({
		userApi,
		otherAccount,
		playwright,
	}) => {
		const other = await signIn(playwright, otherAccount);
		const original = (
			await (
				await other.post(`${API_URL}/posts`, { data: { content: 'e2e original' } })
			).json()
		).post;
		await userApi.post(`${API_URL}/posts`, {
			data: {
				content: `e2e @${otherAccount.userName} answering`,
				parentPostID: original.postID,
			},
		});
		// Answering yourself and mentioning yourself notify nobody.
		const mine = (
			await (await userApi.post(`${API_URL}/posts`, { data: { content: 'e2e mine' } })).json()
		).post;
		await userApi.post(`${API_URL}/posts`, {
			data: { content: 'e2e again', parentPostID: mine.postID },
		});

		await expect
			.poll(async () => (await list(other)).notifications.length, { timeout: 10_000 })
			.toBe(1);
		await new Promise((resolve) => setTimeout(resolve, 500));
		const { notifications } = await list(other);
		const own = await list(userApi);
		await other.dispose();

		expect(notifications).toHaveLength(1);
		expect(notifications[0].type).toBe('REPLY');
		expect(own.notifications).toHaveLength(0);
	});

	test('the list and the stream need a session; the internal route needs the token', async ({
		guestApi,
		userApi,
		otherAccount,
	}) => {
		expect((await guestApi.get(notificationsUrl)).status()).toBe(401);
		expect((await guestApi.post(`${notificationsUrl}/read`)).status()).toBe(401);
		expect((await guestApi.get(`${notificationsUrl}/stream`)).status()).toBe(401);

		const internal = `http://localhost:${SERVICE_PORTS.users}/internal/notifications`;
		const body = { items: [{ recipientID: 'x', actorID: 'y', type: 'REPLY', postID: 'z' }] };
		expect((await guestApi.post(internal, { data: body })).status()).toBe(401);
		// It is not reachable through the public proxy at all.
		expect(
			(await userApi.post(`${API_URL}/internal/notifications`, { data: body })).status(),
		).toBe(404);
		// With the token, an unknown account is skipped without failing the request.
		expect(
			(await guestApi.post(internal, { data: body, headers: internalHeaders })).status(),
		).toBe(200);
		expect((await list(userApi)).notifications).toHaveLength(0);
		void otherAccount;
	});
});
