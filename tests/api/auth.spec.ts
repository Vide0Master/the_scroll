import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';

test.describe('login', () => {
	test('rejects a request without credentials', async ({ guestApi }) => {
		const response = await guestApi.post(`${API_URL}/auth/login`, { data: {} });

		expect(response.status()).toBe(400);
		expect((await response.json()).errorDetails.code).toBe('malformed');
	});

	test('rejects a wrong password and an unknown user with the same answer', async ({
		guestApi,
		account,
	}) => {
		const wrongPassword = await guestApi.post(`${API_URL}/auth/login`, {
			data: { loginName: account.userName, password: 'not-the-password' },
		});
		const unknownUser = await guestApi.post(`${API_URL}/auth/login`, {
			data: { loginName: 'e2e_no_such_user', password: 'not-the-password' },
		});

		expect(wrongPassword.status()).toBe(401);
		expect(unknownUser.status()).toBe(401);
		// Identical bodies: the API must not reveal which usernames exist.
		expect(await wrongPassword.json()).toEqual(await unknownUser.json());
	});

	test('logs in by username and sets an HttpOnly, SameSite=Strict session cookie', async ({
		guestApi,
		account,
	}) => {
		const response = await guestApi.post(`${API_URL}/auth/login`, {
			data: { loginName: account.userName, password: account.password },
		});

		expect(response.status()).toBe(200);

		const cookie = (await guestApi.storageState()).cookies.find(
			(entry) => entry.name === 'accessToken',
		);
		expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict' });
	});

	test('logs in by email as well', async ({ guestApi, account }) => {
		const response = await guestApi.post(`${API_URL}/auth/login`, {
			data: { loginName: account.email, password: account.password },
		});

		expect(response.status()).toBe(200);
	});
});

test.describe('current user', () => {
	test('requires a session', async ({ guestApi }) => {
		const response = await guestApi.get(`${API_URL}/users/me`);

		expect(response.status()).toBe(401);
	});

	test('returns the session user and never the password hash', async ({ userApi, account }) => {
		const response = await userApi.get(`${API_URL}/users/me`);
		const body = await response.json();

		expect(response.status()).toBe(200);
		expect(body.userData).toMatchObject({
			userID: account.userID,
			userName: account.userName,
		});
		expect(JSON.stringify(body)).not.toContain('password');
		expect(JSON.stringify(body)).not.toContain(account.email);
	});
});

test.describe('registration validation', () => {
	// Valid registrations send an email, so only rejected ones are exercised here.
	const valid = {
		email: 'e2e_new@example.test',
		username: 'e2e_new_user',
		password: 'longenough1',
	};

	for (const [name, patch] of [
		['a malformed email', { email: 'not-an-email' }],
		['a username shorter than 3 characters', { username: 'ab' }],
		['a password shorter than 8 characters', { password: 'short' }],
	] as const) {
		test(`rejects ${name}`, async ({ guestApi }) => {
			const response = await guestApi.post(`${API_URL}/auth/register`, {
				data: { ...valid, ...patch },
			});

			expect(response.status()).toBe(400);
			expect((await response.json()).errorDetails.code).toBe('partialRequest');
		});
	}

	test('rejects a taken username and a taken email with 409', async ({ guestApi, account }) => {
		const takenName = await guestApi.post(`${API_URL}/auth/register`, {
			data: { ...valid, username: account.userName },
		});
		const takenEmail = await guestApi.post(`${API_URL}/auth/register`, {
			data: { ...valid, email: account.email },
		});

		expect(takenName.status()).toBe(409);
		expect((await takenName.json()).errorDetails.code).toBe('usernameTaken');
		expect(takenEmail.status()).toBe(409);
		expect((await takenEmail.json()).errorDetails.code).toBe('emailTaken');
	});

	test('rejects a verification token that is not valid', async ({ guestApi }) => {
		const tooShort = await guestApi.post(`${API_URL}/auth/verify`, { data: { token: 'x' } });
		const unknown = await guestApi.post(`${API_URL}/auth/verify`, {
			data: { token: 'a'.repeat(43) },
		});

		expect(tooShort.status()).toBe(400);
		expect(unknown.ok()).toBe(false);
	});
});

test.describe('availability check', () => {
	test('needs a username or an email', async ({ guestApi }) => {
		const response = await guestApi.post(`${API_URL}/auth/check`, { data: {} });

		expect(response.status()).toBe(400);
	});

	test('reports taken and free names', async ({ guestApi, account }) => {
		const taken = await guestApi.post(`${API_URL}/auth/check`, {
			data: { username: account.userName, email: account.email },
		});
		const free = await guestApi.post(`${API_URL}/auth/check`, {
			data: { username: 'e2e_surely_free', email: 'e2e_surely_free@example.test' },
		});

		expect(await taken.json()).toEqual({
			usernameAvailable: false,
			emailAvailable: false,
			emailBlocked: false,
		});
		expect(await free.json()).toEqual({
			usernameAvailable: true,
			emailAvailable: true,
			emailBlocked: false,
		});
	});
});
