import { API_URL } from '../support/env';
import { expect, test } from '../support/fixtures';

const colors = {
	background: '#101010',
	panel: '#202020',
	text: '#f0f0f0',
	accent: '#ff0066',
	border: '#303030',
};
const custom = { id: '11111111-1111-4111-8111-111111111111', name: 'Mine', colors };
const url = `${API_URL}/users/me/settings`;

test.describe('settings', () => {
	test('need a session to read or write', async ({ guestApi }) => {
		expect((await guestApi.get(url)).status()).toBe(401);
		expect(
			(await guestApi.put(url, { data: { themeId: 'dark', customThemes: [] } })).status(),
		).toBe(401);
	});

	test('default to the dark theme until saved, then persist', async ({ userApi }) => {
		const before = await (await userApi.get(url)).json();
		expect(before).toEqual({
			success: true,
			settings: { themeId: 'dark', customThemes: [] },
			isStored: false,
		});

		const payload = { themeId: custom.id, customThemes: [{ ...custom, name: '  Mine  ' }] };
		const saved = await userApi.put(url, { data: payload });
		expect(saved.status()).toBe(200);
		// The name is trimmed on the way in.
		expect((await saved.json()).settings.customThemes[0].name).toBe('Mine');

		const after = await (await userApi.get(url)).json();
		expect(after).toEqual({
			success: true,
			settings: { themeId: custom.id, customThemes: [custom] },
			isStored: true,
		});
	});

	test('a change is visible on the very next read (cache is invalidated)', async ({
		userApi,
	}) => {
		for (const themeId of ['light', 'winter', 'dark']) {
			await userApi.put(url, { data: { themeId, customThemes: [] } });
			const { settings } = await (await userApi.get(url)).json();

			expect(settings.themeId).toBe(themeId);
		}
	});

	const invalid: [string, unknown][] = [
		[
			'a non-hex color',
			{
				themeId: 'dark',
				customThemes: [
					{ ...custom, colors: { ...colors, accent: 'red;background:url(x)' } },
				],
			},
		],
		[
			'more than 10 custom themes',
			{
				themeId: 'dark',
				customThemes: Array.from({ length: 11 }, (_v, i) => ({
					...custom,
					id: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`,
				})),
			},
		],
		['duplicate theme ids', { themeId: 'dark', customThemes: [custom, custom] }],
		['an unknown theme id', { themeId: 'nope', customThemes: [] }],
		['an extra field', { themeId: 'dark', customThemes: [], isAdmin: true }],
	];

	for (const [name, payload] of invalid) {
		test(`reject ${name} and keep the stored value`, async ({ userApi }) => {
			await userApi.put(url, { data: { themeId: 'summer', customThemes: [] } });

			const response = await userApi.put(url, { data: payload });

			expect(response.status()).toBe(400);
			expect((await response.json()).errorDetails.code).toBe('invalidSettings');
			expect((await (await userApi.get(url)).json()).settings.themeId).toBe('summer');
		});
	}

	test('reject a malformed JSON body', async ({ userApi }) => {
		const response = await userApi.put(url, {
			data: Buffer.from('{bad json'),
			// eslint-disable-next-line @typescript-eslint/naming-convention
			headers: { 'content-type': 'application/json' },
		});

		expect(response.status()).toBe(400);
	});

	test("never expose another user's settings", async ({ userApi, otherAccount, playwright }) => {
		await userApi.put(url, { data: { themeId: 'spring', customThemes: [] } });

		const other = await playwright.request.newContext();
		await other.post(`${API_URL}/auth/login`, {
			data: { loginName: otherAccount.userName, password: otherAccount.password },
		});
		const { settings } = await (await other.get(url)).json();
		await other.dispose();

		expect(settings.themeId).toBe('dark');
	});
});
