import path from 'node:path';
import dotenv from 'dotenv';
import { expand } from 'dotenv-expand';
import { defineConfig, devices } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');

// Loaded here (not only by `dotenv-cli`) so the VS Code Playwright extension works without npm.
expand(dotenv.config({ path: path.join(root, '.env'), quiet: true }));

const baseURL = `http://localhost:${process.env.PORT_FRONTEND ?? '3020'}`;
// `npm run test:unit` needs no database or services.
const skipStack = process.env.PW_SKIP_STACK === '1';

const browserUse = {
	...devices['Desktop Chrome'],
	// Reuses the Chromium build the Playwright MCP already installed.
	channel: 'chromium',
	locale: 'en-US',
};

/**
 * The parts of the product that can be tested on their own. The last two touch shared global
 * state (Redis keys, the uploads folder), so run them alone rather than alongside other areas.
 */
const areas = [
	{ name: 'health', files: 'api/health.spec.ts' },
	{ name: 'auth', files: ['api/auth.spec.ts', 'e2e/auth.spec.ts'] },
	{ name: 'navigation', files: 'e2e/navigation.spec.ts' },
	{ name: 'users', files: ['api/users.spec.ts', 'e2e/profile.spec.ts'] },
	{ name: 'popularity', files: ['api/popularity.spec.ts', 'e2e/popularity.spec.ts'] },
	{ name: 'search', files: ['api/search.spec.ts', 'e2e/search.spec.ts'] },
	{ name: 'qol', files: 'e2e/qol.spec.ts' },
	{
		name: 'notifications',
		files: ['api/follows.spec.ts', 'api/notifications.spec.ts',
			'api/like-notifications.spec.ts',
			'e2e/notifications.spec.ts'],
	},
	{ name: 'moderation', files: ['api/moderation.spec.ts', 'e2e/moderation.spec.ts'] },
	{ name: 'roles', files: ['api/roles.spec.ts', 'e2e/roles.spec.ts'] },
	{ name: 'profile-editor', files: ['api/profile.spec.ts', 'e2e/profile-editor.spec.ts'] },
	{ name: 'settings', files: ['api/settings.spec.ts', 'e2e/settings.spec.ts'] },
	{
		name: 'posts',
		files: [
			'api/posts.spec.ts',
			'api/post-delete.spec.ts',
			'api/pagination.spec.ts',
			'e2e/posts.spec.ts',
			'e2e/infinite-scroll.spec.ts',
		],
	},
	{ name: 'replies', files: ['api/replies.spec.ts', 'e2e/replies.spec.ts'] },
	{ name: 'entities', files: ['api/entities.spec.ts', 'e2e/entities.spec.ts'] },
	{ name: 'media', files: 'api/media.spec.ts' },
	{ name: 'cache', files: 'api/cache.spec.ts' },
	{ name: 'media-lifecycle', files: 'api/media-lifecycle.spec.ts' },
];

export default defineConfig({
	testDir: '.',
	outputDir: './.results',
	reporter: [['list'], ['html', { outputFolder: './.report', open: 'never' }]],
	// Tests share one dev database and one Redis cache, so they run one at a time.
	workers: 1,
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	use: {
		baseURL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	webServer: skipStack
		? undefined
		: {
				// Direct binary, no `npx` layer: the shutdown signal must reach turbo itself.
				command: './node_modules/.bin/turbo run dev',
				cwd: root,
				url: baseURL,
				// Use the stack from `npm run dev` when it is already up.
				reuseExistingServer: true,
				timeout: 120_000,
				// Playwright kills the server with SIGKILL by default, and turbo then cannot stop
				// its per-service process groups: they keep running and hold the ports. SIGTERM
				// lets turbo shut every service down.
				gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
			},
	projects: [
		{ name: 'unit', testMatch: 'unit/**/*.test.ts' },
		{ name: 'stack', testMatch: 'setup/stack.setup.ts' },
		// One project per part of the product, each holding its API and browser tests, so the
		// VS Code plugin (and `npm run test:<area>`) can run just that part. Every one only needs
		// the readiness check; the accounts and posts a test wants are created by its fixtures.
		...areas.map(({ name, files }) => ({
			name,
			testMatch: files,
			dependencies: ['stack'],
			use: browserUse,
		})),
		// Manual poking around; only defined with PW_PLAYGROUND=1 (`npm run play:<area>`).
		...(process.env.PW_PLAYGROUND === '1'
			? [
					{
						name: 'playground',
						testMatch: 'playground/**/*.play.ts',
						dependencies: ['stack'],
						use: { ...browserUse, headless: false },
					},
				]
			: []),
	],
});
