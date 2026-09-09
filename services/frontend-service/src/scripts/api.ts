import axios from 'axios';
import type { Types } from '@the-scroll/types';

export const apiClient = axios.create({
	baseURL: '/api',
	headers: {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		'Content-Type': 'application/json',
	},
	timeout: 10000,
	withCredentials: true,
});

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
			return response.data.emailAvailable;
		},
		register: async (data: Types['api']['auth']['register']['req']) => {
			const response = await apiClient.post<Types['api']['auth']['register']['res']>(
				'/auth/register',
				data,
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

	users: {
		getMe: async () => {
			const response = await apiClient.get<Types['api']['auth']['user']['res']>('/users/me');
			return response.data;
		},
		getByUsername: async (userName: string) => {
			const response = await apiClient.get<Types['api']['auth']['user']['res']>(
				`/users/${userName}`,
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
		getFeed: async (limit = 20, cursor?: string) => {
			const response = await apiClient.get<Types['api']['posts']['feed']['res']>(
				'/posts/feed',
				{ params: { limit, cursor } },
			);
			return response.data;
		},
		getById: async (id: string) => {
			const response = await apiClient.get<Types['api']['posts']['getOne']['res']>(
				`/posts/${id}`,
			);
			return response.data;
		},
		getByAuthor: async (authorId: string) => {
			const response = await apiClient.get<Types['api']['posts']['byUser']['res']>(
				`/posts/user/${authorId}`,
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
