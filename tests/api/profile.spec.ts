import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';

const url = `${API_URL}/users/me/profile`;
const image = (ext = 'png') => `/api/media/file/11111111-2222-4333-8444-555555555555.${ext}`;
const empty = { visibleName: null, avatarUrl: null, bannerUrl: null, bannerGradient: null };

test.describe('profile update', () => {
	test.afterEach(async ({ userApi }) => {
		await userApi.put(url, { data: empty });
	});

	test('needs a session', async ({ guestApi }) => {
		expect((await guestApi.put(url, { data: empty })).status()).toBe(401);
	});

	test('saves the fields and returns the public view, never email or password', async ({
		userApi,
		account,
	}) => {
		const data = {
			visibleName: '  Test Person  ',
			avatarUrl: image(),
			bannerUrl: null,
			bannerGradient: { from: '#112233', to: '#aabbcc' },
		};

		const response = await userApi.put(url, { data });
		const body = await response.json();

		expect(response.status()).toBe(200);
		expect(body.userData).toMatchObject({
			userID: account.userID,
			userName: account.userName,
			visibleName: 'Test Person',
			avatarUrl: image(),
			bannerUrl: null,
			bannerGradient: { from: '#112233', to: '#aabbcc' },
		});
		expect(JSON.stringify(body)).not.toContain('password');
		expect(JSON.stringify(body)).not.toContain(account.email);
	});

	test('the new profile is visible at once to the owner, to guests and on posts', async ({
		userApi,
		guestApi,
		account,
	}) => {
		// Warm every cached read that embeds the profile before changing it.
		await userApi.get(`${API_URL}/users/me`);
		await guestApi.get(`${API_URL}/users/${account.userName}`);
		const { post } = await (
			await userApi.post(`${API_URL}/posts`, { data: { content: 'e2e profile post' } })
		).json();
		await guestApi.get(`${API_URL}/posts/${post.postID}`);

		await userApi.put(url, {
			data: { ...empty, visibleName: 'Fresh Name', avatarUrl: image('webp') },
		});

		const me = await (await userApi.get(`${API_URL}/users/me`)).json();
		const publicView = await (
			await guestApi.get(`${API_URL}/users/${account.userName}`)
		).json();
		const postView = await (await guestApi.get(`${API_URL}/posts/${post.postID}`)).json();

		for (const profile of [me.userData, publicView.userData, postView.post.author]) {
			expect(profile).toMatchObject({ visibleName: 'Fresh Name', avatarUrl: image('webp') });
		}
	});

	test('clears everything with nulls', async ({ userApi }) => {
		await userApi.put(url, { data: { ...empty, visibleName: 'Temp', avatarUrl: image() } });

		const response = await userApi.put(url, { data: empty });

		expect((await response.json()).userData).toMatchObject(empty);
	});

	const invalid: [string, Record<string, unknown>][] = [
		['an empty display name', { visibleName: '   ' }],
		['a display name over 50 characters', { visibleName: 'x'.repeat(51) }],
		['an avatar on another site', { avatarUrl: 'https://evil.example/track.png' }],
		['a javascript: avatar', { avatarUrl: 'javascript:alert(1)' }],
		['a path-traversal avatar', { avatarUrl: '/api/media/file/../../secret.png' }],
		['a video as avatar', { avatarUrl: image('mp4') }],
		['a banner that is not a media file', { bannerUrl: '/api/posts/feed' }],
		['a non-hex gradient color', { bannerGradient: { from: 'red', to: '#000000' } }],
		['a css-injecting gradient color', { bannerGradient: { from: '#000000', to: '#fff;x' } }],
		[
			'both a banner image and a gradient',
			{ bannerUrl: image(), bannerGradient: { from: '#000000', to: '#ffffff' } },
		],
		['an unknown field', { isAdmin: true }],
		['a userID meant for someone else', { userID: '00000000-0000-4000-8000-000000000000' }],
	];

	for (const [name, patch] of invalid) {
		test(`rejects ${name} and keeps the stored profile`, async ({ userApi }) => {
			await userApi.put(url, { data: { ...empty, visibleName: 'Keep Me' } });

			const response = await userApi.put(url, { data: { ...empty, ...patch } });

			expect(response.status()).toBe(400);
			expect((await response.json()).errorDetails.code).toBe('invalidProfile');
			expect(
				(await (await userApi.get(`${API_URL}/users/me`)).json()).userData.visibleName,
			).toBe('Keep Me');
		});
	}

	test('rejects a partial body (fields are replaced in full)', async ({ userApi }) => {
		const response = await userApi.put(url, { data: { visibleName: 'Only Name' } });

		expect(response.status()).toBe(400);
	});
});
