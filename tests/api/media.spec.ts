import { API_URL, BASE_URL } from '../support/env';
import { expect, test } from '../support/fixtures';
import { png, removeUploaded } from '../support/media';

test.describe('media upload', () => {
	test('requires a session', async ({ guestApi }) => {
		const response = await guestApi.post(`${API_URL}/media/upload`, {
			multipart: { file: { name: 'a.png', mimeType: 'image/png', buffer: png } },
		});

		expect(response.status()).toBe(401);
	});

	test('stores an image and serves it back', async ({ userApi, guestApi }) => {
		const response = await userApi.post(`${API_URL}/media/upload`, {
			multipart: {
				file: { name: '../../evil name.png', mimeType: 'image/png', buffer: png },
			},
		});
		const { file } = await response.json();

		try {
			expect(response.status()).toBe(201);
			expect(file).toMatchObject({ mimeType: 'image/png', size: png.length });
			// The stored name is generated, never derived from the client's filename.
			expect(file.url).toMatch(/^\/api\/media\/file\/[0-9a-f-]{36}\.png$/);

			const served = await guestApi.get(`${BASE_URL}${file.url}`);
			expect(served.status()).toBe(200);
			expect(await served.body()).toEqual(png);
		} finally {
			await removeUploaded(file?.url ? [file.url] : []);
		}
	});

	test('rejects a file type that is not an allowed image or video', async ({ userApi }) => {
		const response = await userApi.post(`${API_URL}/media/upload`, {
			multipart: {
				file: { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') },
			},
		});

		expect(response.status()).toBe(415);
		expect((await response.json()).errorDetails.code).toBe('unsupportedType');
	});

	test('rejects a request without a file', async ({ userApi }) => {
		const response = await userApi.post(`${API_URL}/media/upload`, {
			multipart: { note: 'no file here' },
		});

		expect(response.ok()).toBe(false);
	});
});
