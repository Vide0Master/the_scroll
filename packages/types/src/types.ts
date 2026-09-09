export interface BaseErrorResponse {
	code: string;
	description: string;
}

export interface PostEntity {
	id: string;
	authorId: string;
	content: string;
	mediaUrls: string[];
	createdAt: string;
	updatedAt: string;
}

export interface MediaEntity {
	id: string;
	url: string;
	filename: string;
	mimetype: string;
	size: number;
}

export interface Types {
	api: {
		auth: {
			checkAvailable: {
				req: { email?: string; username?: string };
				res: {
					emailAvailable?: boolean;
					usernameAvailable?: boolean;
					errorDetails?: BaseErrorResponse;
				};
			};
			register: {
				req: { email: string; username: string; password: string };
				res: { success: boolean; errorDetails?: BaseErrorResponse };
			};
			login: {
				req: { loginName: string; password: string };
				res: { success: boolean; errorDetails?: BaseErrorResponse };
			};
			user: {
				req: { userName: string };
				res: {
					userData?: {
						userID: string;
						userName: string;
						visibleName: string | null;
						createdAt: Date;
					};
					errorDetails?: BaseErrorResponse;
				};
			};
		};
		posts: {
			create: {
				req: { content: string; mediaUrls?: string[] };
				res: { success: boolean; post?: PostEntity; errorDetails?: BaseErrorResponse };
			};
			getOne: {
				req: { id: string };
				res: { post?: PostEntity; errorDetails?: BaseErrorResponse };
			};
			feed: {
				req: { limit?: number; cursor?: string };
				res: { posts: PostEntity[]; nextCursor?: string; errorDetails?: BaseErrorResponse };
			};
			byUser: {
				req: { authorId: string; limit?: number };
				res: { posts: PostEntity[]; errorDetails?: BaseErrorResponse };
			};
		};
		media: {
			upload: {
				res: { success: boolean; file?: MediaEntity; errorDetails?: BaseErrorResponse };
			};
		};
	};
}
