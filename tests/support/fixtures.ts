import {
	expect,
	test as base,
	type APIRequestContext,
	type BrowserContext,
	type Page,
} from '@playwright/test';
import { createAccount, deleteAccount, type TestAccount } from './accounts';
import { API_URL, BASE_URL } from './env';

interface TestFixtures {
	/** API client that is logged in as `account` (session cookie in its jar). */
	userApi: APIRequestContext;
	/** Browser page that is logged in as `account`. */
	userPage: Page;
	/** A second, unrelated user, created and removed per test. */
	otherAccount: TestAccount;
	/** API client without any session. */
	guestApi: APIRequestContext;
}

interface WorkerFixtures {
	account: TestAccount;
}

// Web fonts come from Google: offline or behind a filter that request can hang, and then a page
// never reaches its `load` event. The app falls back to system fonts.
async function blockWebFonts(context: BrowserContext) {
	await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
	account: [
		// eslint-disable-next-line no-empty-pattern
		async ({}, use) => {
			const account = await createAccount();
			await use(account);
			await deleteAccount(account);
		},
		{ scope: 'worker' },
	],

	guestApi: async ({ playwright }, use) => {
		const context = await playwright.request.newContext();
		await use(context);
		await context.dispose();
	},

	userApi: async ({ playwright, account }, use) => {
		const context = await playwright.request.newContext();
		const response = await context.post(`${API_URL}/auth/login`, {
			data: { loginName: account.userName, password: account.password },
		});
		expect(response.ok(), 'test account can log in').toBe(true);
		await use(context);
		await context.dispose();
	},

	// The built-in context (used by the plain `page` of guest tests) gets the same font block.
	context: async ({ context }, use) => {
		await blockWebFonts(context);
		await use(context);
	},

	userPage: async ({ browser, userApi }, use) => {
		const context = await browser.newContext({
			baseURL: BASE_URL,
			locale: 'en-US',
			storageState: await userApi.storageState(),
		});
		await blockWebFonts(context);
		const page = await context.newPage();
		await use(page);
		await context.close();
	},

	otherAccount: async ({ playwright }, use) => {
		void playwright;
		const account = await createAccount();
		await use(account);
		await deleteAccount(account);
	},
});

export { expect };
