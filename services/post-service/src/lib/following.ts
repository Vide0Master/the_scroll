/** Ids of the accounts the session user follows, from user-service; null when it can't be asked. */
export async function fetchFollowingIDs(
	userServiceUrl: string,
	sessionToken: string,
): Promise<string[] | null> {
	try {
		const response = await fetch(`${userServiceUrl}/users/me/following-ids`, {
			headers: { cookie: `accessToken=${sessionToken}` },
		});

		if (!response.ok) {
			return null;
		}

		const data = (await response.json()) as { userIDs?: string[] };
		return Array.isArray(data.userIDs) ? data.userIDs : null;
	} catch (error) {
		console.error('Failed to load the following list:', error);
		return null;
	}
}
