import { AxiosError, type AxiosResponse } from 'axios';
import { expect, test } from '@playwright/test';
import { getApiError, isProfileNotFound } from '../../../services/frontend-service/src/scripts/api';

function axiosError(status: number, data: unknown): AxiosError {
	const response = { status, statusText: '', headers: {}, config: {}, data };
	return new AxiosError(
		'failed',
		String(status),
		undefined,
		undefined,
		response as unknown as AxiosResponse,
	);
}

test.describe('getApiError', () => {
	test('reads the backend error code and retryAfter', () => {
		expect(
			getApiError(
				axiosError(429, { errorDetails: { code: 'resendCooldown' }, retryAfter: 42 }),
			),
		).toMatchObject({
			code: 'resendCooldown',
			retryAfter: 42,
		});
	});

	test('exposes the HTTP status, also when the body has no error code (router-level 404)', () => {
		expect(getApiError(axiosError(404, { message: 'Route GET:/x not found' })).status).toBe(
			404,
		);
	});

	test('returns an empty object for anything that is not an axios error', () => {
		expect(getApiError(new Error('boom'))).toEqual({});
	});
});

test.describe('isProfileNotFound', () => {
	test('is true for the backend noUser code and for router-level rejections of the name', () => {
		expect(isProfileNotFound({ code: 'noUser', status: 404 })).toBe(true);
		expect(isProfileNotFound({ status: 404 })).toBe(true);
		expect(isProfileNotFound({ status: 414 })).toBe(true);
		expect(isProfileNotFound({ status: 400 })).toBe(true);
	});

	test('is false for server or network failures', () => {
		expect(isProfileNotFound({ status: 500 })).toBe(false);
		expect(isProfileNotFound({})).toBe(false);
	});
});
