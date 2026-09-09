import { BaseSessionUser } from '@the-scroll/backend-core';
import { Types } from '@the-scroll/types';

export async function validateUserSessionViaService(
	sessionToken: string,
	userServiceUrl: string,
): Promise<BaseSessionUser | null> {
	const targetUrl = `${userServiceUrl}/users/me`;

	try {
		const response = await fetch(targetUrl, {
			method: 'GET',
			headers: {
				cookie: `accessToken=${sessionToken}`,
			},
		});

		if (!response.ok) {
			console.error(
				`User-service validation failed: status ${response.status} from ${targetUrl}`,
			);
			return null;
		}

		const data = (await response.json()) as Types['api']['auth']['user']['res'];

		if (!data.userData) {
			console.error(`User-service returned empty userData from ${targetUrl}`);
			return null;
		}

		return {
			userID: data.userData.userID,
			userName: data.userData.userName,
			visibleName: data.userData.visibleName,
		};
	} catch (error) {
		console.error(`Network error connecting to ${targetUrl}:`, error);
		return null;
	}
}
