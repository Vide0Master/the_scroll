import axios, { isAxiosError } from 'axios';
import type { Types, UserSettings } from '@the-scroll/types';

export const apiClient = axios.create({
	baseURL: '/api',
	headers: {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		'Content-Type': 'application/json',
	},
	timeout: 10000,
	withCredentials: true,
});

export interface ApiErrorInfo {
	code?: string;
	status?: number;
	retryAfter?: number;
}

// Backend errors come back as { errorDetails: { code }, retryAfter? } with a 4xx status.
export function getApiError(error: unknown): ApiErrorInfo {
	if (isAxiosError(error)) {
		return {
			code: error.response?.data?.errorDetails?.code,
			status: error.response?.status,
			retryAfter: error.response?.data?.retryAfter,
		};
	}

	return {};
}

// Looking a profile up by name: besides the backend's own "noUser", the router rejects names it
// cannot route (too long: 414, malformed: 400, unknown route: 404); all mean "no such profile".
export function isProfileNotFound(info: ApiErrorInfo): boolean {
	return (
		info.code === 'noUser' || info.status === 404 || info.status === 414 || info.status === 400
	);
}

export const api = {
	auth: {
		checkUsername: async (username: string) => {
			const response = await apiClient.post<Types['api']['auth']['checkAvailable']['res']>(
				'/auth/check',
				{ username },
			);
			return response.data.usernameAvailable;
		},
		checkEmail: async (email: string) => {
			const response = await apiClient.post<Types['api']['auth']['checkAvailable']['res']>(
				'/auth/check',
				{ email },
			);
			// `isBlocked`: the email belongs to a banned account, which is a different message than "taken".
			return {
				isAvailable: response.data.emailAvailable ?? false,
				isBlocked: response.data.emailBlocked ?? false,
			};
		},
		register: async (data: Types['api']['auth']['register']['req']) => {
			const response = await apiClient.post<Types['api']['auth']['register']['res']>(
				'/auth/register',
				data,
			);
			return response.data;
		},
		resend: async (id: string) => {
			const response = await apiClient.post<Types['api']['auth']['resend']['res']>(
				'/auth/register/resend',
				{ id },
			);
			return response.data;
		},
		getRegistrationStatus: async (id: string) => {
			const response = await apiClient.get<Types['api']['auth']['status']['res']>(
				`/auth/register/status/${id}`,
			);
			return response.data;
		},
		verify: async (token: string) => {
			const response = await apiClient.post<Types['api']['auth']['verify']['res']>(
				'/auth/verify',
				{ token },
			);
			return response.data;
		},
		login: async (data: Types['api']['auth']['login']['req']) => {
			const response = await apiClient.post<Types['api']['auth']['login']['res']>(
				'/auth/login',
				data,
			);
			return response.data;
		},
	},

	follows: {
		follow: async (userName: string) => {
			const response = await apiClient.put<Types['api']['follows']['follow']['res']>(
				`/users/${encodeURIComponent(userName)}/follow`,
			);
			return response.data;
		},
		unfollow: async (userName: string) => {
			const response = await apiClient.delete<Types['api']['follows']['unfollow']['res']>(
				`/users/${encodeURIComponent(userName)}/follow`,
			);
			return response.data;
		},
		stats: async (userName: string) => {
			const response = await apiClient.get<Types['api']['follows']['stats']['res']>(
				`/users/${encodeURIComponent(userName)}/follow-stats`,
			);
			return response.data;
		},
	},

	notifications: {
		list: async () => {
			const response =
				await apiClient.get<Types['api']['notifications']['list']['res']>('/notifications');
			return response.data;
		},
		readAll: async (ids?: string[]) => {
			const response = await apiClient.post<Types['api']['notifications']['readAll']['res']>(
				'/notifications/read',
				ids ? { ids } : {},
			);
			return response.data;
		},
	},

	admin: {
		metrics: async () => {
			const response =
				await apiClient.get<Types['api']['admin']['metrics']['res']>(
					'/users/admin/metrics',
				);
			return response.data;
		},
		users: async (query?: string, banned?: boolean) => {
			const response = await apiClient.get<Types['api']['admin']['users']['res']>(
				'/users/admin/users',
				{ params: { query: query || undefined, banned: banned || undefined } },
			);
			return response.data;
		},
		ban: async (userName: string, reason?: string) => {
			const response = await apiClient.post<Types['api']['admin']['ban']['res']>(
				`/users/admin/users/${encodeURIComponent(userName)}/ban`,
				{ reason: reason || undefined },
			);
			return response.data;
		},
		unban: async (userName: string) => {
			const response = await apiClient.delete<Types['api']['admin']['unban']['res']>(
				`/users/admin/users/${encodeURIComponent(userName)}/ban`,
			);
			return response.data;
		},
	},

	users: {
		setRoles: async (
			userName: string,
			roles: Types['api']['users']['setRoles']['req']['roles'],
		) => {
			const response = await apiClient.put<Types['api']['users']['setRoles']['res']>(
				`/users/${encodeURIComponent(userName)}/roles`,
				{ roles },
			);
			return response.data;
		},
		getMe: async () => {
			const response = await apiClient.get<Types['api']['auth']['user']['res']>('/users/me');
			return response.data;
		},
		search: async (
			query: string,
			options?: { match?: 'prefix' | 'contains'; limit?: number },
		) => {
			const response = await apiClient.get<Types['api']['users']['search']['res']>(
				`/users/search/${encodeURIComponent(query)}`,
				{ params: options },
			);
			return response.data;
		},
		getByUsername: async (userName: string) => {
			const response = await apiClient.get<Types['api']['auth']['user']['res']>(
				`/users/${encodeURIComponent(userName)}`,
			);
			return response.data;
		},
	},

	profile: {
		update: async (profile: Types['api']['profile']['update']['req']) => {
			const response = await apiClient.put<Types['api']['profile']['update']['res']>(
				'/users/me/profile',
				profile,
			);
			return response.data;
		},
	},

	settings: {
		get: async () => {
			const response =
				await apiClient.get<Types['api']['settings']['get']['res']>('/users/me/settings');
			return response.data;
		},
		save: async (settings: UserSettings) => {
			const response = await apiClient.put<Types['api']['settings']['put']['res']>(
				'/users/me/settings',
				settings,
			);
			return response.data;
		},
	},

	posts: {
		create: async (data: Types['api']['posts']['create']['req']) => {
			const response = await apiClient.post<Types['api']['posts']['create']['res']>(
				'/posts',
				data,
			);
			return response.data;
		},
		getFeed: async (limit = 20, cursor?: string, scope?: 'all' | 'following') => {
			const response = await apiClient.get<Types['api']['posts']['feed']['res']>(
				'/posts/feed',
				{ params: { limit, cursor, scope } },
			);
			return response.data;
		},
		getById: async (id: string) => {
			const response = await apiClient.get<Types['api']['posts']['getOne']['res']>(
				`/posts/${id}`,
			);
			return response.data;
		},
		getByAuthor: async (
			authorId: string,
			kind: 'posts' | 'replies' = 'posts',
			cursor?: string,
		) => {
			const response = await apiClient.get<Types['api']['posts']['byUser']['res']>(
				`/posts/user/${authorId}`,
				{ params: { kind, cursor } },
			);
			return response.data;
		},
		search: async (q: string, cursor?: string) => {
			const response = await apiClient.get<Types['api']['posts']['search']['res']>(
				'/posts/search',
				{ params: { q, cursor } },
			);
			return response.data;
		},
		tags: async (q: string, match?: 'prefix' | 'contains', limit?: number) => {
			const response = await apiClient.get<Types['api']['posts']['tags']['res']>(
				'/posts/tags',
				{ params: { q, match, limit } },
			);
			return response.data;
		},
		getByHashtag: async (tag: string, cursor?: string) => {
			const response = await apiClient.get<Types['api']['posts']['byHashtag']['res']>(
				`/posts/hashtag/${encodeURIComponent(tag)}`,
				{ params: { cursor } },
			);
			return response.data;
		},
		getReplies: async (postID: string, cursor?: string) => {
			const response = await apiClient.get<Types['api']['posts']['replies']['res']>(
				`/posts/${postID}/replies`,
				{ params: { cursor } },
			);
			return response.data;
		},
		trending: async (limit?: number) => {
			const response = await apiClient.get<Types['api']['posts']['trending']['res']>(
				'/posts/trending',
				{ params: { limit } },
			);
			return response.data;
		},
		like: async (postID: string) => {
			const response = await apiClient.put<Types['api']['posts']['like']['res']>(
				`/posts/${postID}/like`,
			);
			return response.data;
		},
		unlike: async (postID: string) => {
			const response = await apiClient.delete<Types['api']['posts']['unlike']['res']>(
				`/posts/${postID}/like`,
			);
			return response.data;
		},
		view: async (postID: string) => {
			const response = await apiClient.post<Types['api']['posts']['view']['res']>(
				`/posts/${postID}/view`,
			);
			return response.data;
		},
		metrics: async () => {
			const response =
				await apiClient.get<Types['api']['posts']['metrics']['res']>(
					'/posts/admin/metrics',
				);
			return response.data;
		},
		moderate: async (postID: string, reason?: string) => {
			const response = await apiClient.delete<Types['api']['posts']['moderate']['res']>(
				`/posts/${postID}/moderation`,
				{ data: { reason: reason || undefined } },
			);
			return response.data;
		},
		moderationList: async () => {
			const response =
				await apiClient.get<Types['api']['posts']['moderationList']['res']>(
					'/posts/moderation/list',
				);
			return response.data;
		},
		remove: async (postID: string) => {
			const response = await apiClient.delete<Types['api']['posts']['remove']['res']>(
				`/posts/${postID}`,
			);
			return response.data;
		},
		update: async (postID: string, data: Types['api']['posts']['update']['req']) => {
			const response = await apiClient.patch<Types['api']['posts']['update']['res']>(
				`/posts/${postID}`,
				data,
			);
			return response.data;
		},
	},

	media: {
		upload: async (file: File) => {
			const formData = new FormData();
			formData.append('file', file);

			const response = await apiClient.post<Types['api']['media']['upload']['res']>(
				'/media/upload',
				formData,
				{
					headers: {
						// eslint-disable-next-line @typescript-eslint/naming-convention
						'Content-Type': 'multipart/form-data',
					},
				},
			);
			return response.data;
		},
	},
};
