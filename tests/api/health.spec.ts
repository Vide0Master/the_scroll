import { expect, test } from '@playwright/test';
import { SERVICE_PORTS } from '../support/env';

test.describe('GET /health', () => {
	for (const service of ['posts', 'media'] as const) {
		test(`${service}-service reports it is up`, async ({ request }) => {
			const response = await request.get(`http://localhost:${SERVICE_PORTS[service]}/health`);

			expect(response.status()).toBe(200);
			expect(await response.json()).toMatchObject({ status: 'ok' });
		});
	}
});
