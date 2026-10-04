export * from './textEntities';

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

export type MailStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CONFIRMED';

// Shared limits for posts and their media, enforced by post-service, media-service and the
// frontend (client-side checks are a UX convenience; the servers are the real enforcement).
export const POST_CONTENT_MAX_LENGTH = 2000;
export const POST_MEDIA_MAX_FILES = 12;
export const MEDIA_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export interface ThemeColors {
	background: string;
	panel: string;
	text: string;
	accent: string;
	border: string;
}

export interface CustomTheme {
	id: string;
	name: string;
	colors: ThemeColors;
}

export interface UserSettings {
	themeId: string;
	customThemes: CustomTheme[];
}

export const PROFILE_VISIBLE_NAME_MAX_LENGTH = 50;

/** What a stored file is used for; `refID` is the id of the post or the user. */
export type MediaUsageKind = 'post' | 'avatar' | 'banner';

/** The complete list of files one entity uses right now (an empty list releases them all). */
export interface MediaUsageSet {
	kind: MediaUsageKind;
	refID: string;
	urls: string[];
}

/** Sent by post-service / user-service to media-service on every write that changes media. */
export interface MediaUsageRequest {
	/** The session user doing the write; files uploaded by someone else can't be attached. */
	ownerID: string;
	usages: MediaUsageSet[];
}

export interface BannerGradient {
	from: string;
	to: string;
}

/** What other people see of an account; the server only stores and validates these fields. */
export interface AuthorProfile {
	userID: string;
	userName: string;
	visibleName: string | null;
	avatarUrl: string | null;
}

/**
 * Roles an account can hold, any number at once; an account with none is a regular user and has
 * no badge. Mirrored by the `Role` enum in user-service's Prisma schema.
 */
export const USER_ROLES = ['ADMIN', 'MODERATOR'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface UserProfile extends AuthorProfile {
	roles: UserRole[];
	/** The account is blocked: it cannot log in, post or register again with its email. */
	isBanned: boolean;
	bannerUrl: string | null;
	bannerGradient: BannerGradient | null;
	createdAt: Date;
}

/** Full replacement of the editable profile fields; `null` clears a field. */
export interface ProfileUpdate {
	visibleName: string | null;
	avatarUrl: string | null;
	bannerUrl: string | null;
	bannerGradient: BannerGradient | null;
}

/** The post a reply answers: enough to write "replying to @author" and link to it. */
export interface ReplyContext {
	postID: string;
	/** The answered post was deleted; its author is not disclosed then. */
	isDeleted: boolean;
	author: AuthorProfile | null;
}

export interface FeedPost {
	postID: string;
	/** Empty for a deleted post: its author is not disclosed. */
	authorID: string;
	author?: AuthorProfile | null;
	content: string;
	media: string[];
	/** Set when this post is a reply. */
	parentPostID: string | null;
	replyTo: ReplyContext | null;
	/** Direct replies to this post. */
	replyCount: number;
	/** Usernames mentioned in `content` that belong to real accounts; only these become links. */
	mentions: string[];
	likeCount: number;
	/** The viewer liked it; always false without a session. */
	likedByMe: boolean;
	/** Distinct signed-in accounts that saw it (not the author). */
	viewCount: number;
	/** Deleted: `content` is empty and `media` has no files. */
	isDeleted: boolean;
	/** The deletion was done by a moderator, not by the author. */
	removedByModerator: boolean;
	createdAt: string;
}

/** Days of activity that count towards trends and popularity. */
export const TREND_WINDOW_DAYS = 3;

/** A hashtag with the likes and replies its posts got inside the trend window. */
export interface TrendingTag {
	tag: string;
	score: number;
}

/** An account with the likes and replies its posts got inside the trend window. */
export interface TrendingUser {
	user: AuthorProfile;
	score: number;
}

/** Numbers for the admin panel; `posts` comes from post-service, `users` from user-service. */
export interface PostMetrics {
	posts: number;
	replies: number;
	deleted: number;
	likes: number;
	views: number;
	postsToday: number;
	likesToday: number;
	viewsToday: number;
	topTags: TrendingTag[];
	topPosts: { postID: string; views: number; likes: number }[];
}

export interface UserMetrics {
	users: number;
	banned: number;
	usersToday: number;
	follows: number;
}

export type NotificationType = 'FOLLOW' | 'REPLY' | 'MENTION' | 'LIKE';

/** One entry of a user's notification list. `postID` is the reply or the post that mentions them. */
export interface NotificationItem {
	id: string;
	type: NotificationType;
	actor: AuthorProfile | null;
	postID: string | null;
	createdAt: string;
	isRead: boolean;
}

/** A hashtag with the number of posts that carry it. */
export interface SearchTag {
	tag: string;
	count: number;
}

export const SEARCH_QUERY_MAX_LENGTH = 100;

export interface FollowStats {
	followerCount: number;
	followingCount: number;
	/** Whether the viewer follows this account (false for guests). */
	isFollowing: boolean;
}

/** An account as the admin panel lists it; `email` is only sent to admins. */
export interface AdminUser extends AuthorProfile {
	roles: UserRole[];
	isBanned: boolean;
	banReason: string | null;
	bannedAt: string | null;
	email?: string;
	createdAt: string;
}

export const BAN_REASON_MAX_LENGTH = 300;

export interface Types {
	api: {
		auth: {
			checkAvailable: {
				req: { email?: string; username?: string };
				res: {
					emailAvailable?: boolean;
					/** The email belongs to a blocked account and can never register again. */
					emailBlocked?: boolean;
					usernameAvailable?: boolean;
					errorDetails?: BaseErrorResponse;
				};
			};
			register: {
				req: { email: string; username: string; password: string; replacesID?: string };
				res: {
					success: boolean;
					pendingID?: string;
					status?: MailStatus;
					error?: string;
					errorDetails?: BaseErrorResponse;
				};
			};
			resend: {
				req: { id: string };
				res: {
					success: boolean;
					status?: MailStatus;
					retryAfter?: number;
					errorDetails?: BaseErrorResponse;
				};
			};
			status: {
				req: { id: string };
				res: {
					success: boolean;
					status?: MailStatus;
					retryAfter?: number;
					error?: string;
					errorDetails?: BaseErrorResponse;
				};
			};
			verify: {
				req: { token: string };
				res: { success: boolean; errorDetails?: BaseErrorResponse };
			};
			login: {
				req: { loginName: string; password: string };
				res: { success: boolean; errorDetails?: BaseErrorResponse };
			};
			user: {
				req: { userName: string };
				res: {
					userData?: UserProfile;
					errorDetails?: BaseErrorResponse;
				};
			};
		};
		posts: {
			create: {
				/** With `parentPostID` the new post is a reply to that post. */
				req: { content: string; mediaUrls?: string[]; parentPostID?: string };
				res: { success: boolean; post?: FeedPost; errorDetails?: BaseErrorResponse };
			};
			update: {
				req: { content: string; mediaUrls?: string[] };
				res: { success: boolean; post?: FeedPost; errorDetails?: BaseErrorResponse };
			};
			remove: {
				req: { postID: string };
				res: { success: boolean; errorDetails?: BaseErrorResponse };
			};
			/** Moderators and admins: deletes any post; the reason is kept for the record only. */
			moderate: {
				req: { postID: string; reason?: string };
				res: { success: boolean; errorDetails?: BaseErrorResponse };
			};
			/** Moderators and admins: latest posts, removed ones included. */
			moderationList: {
				req: { limit?: number };
				res: { posts: FeedPost[]; errorDetails?: BaseErrorResponse };
			};
			/** Posts containing every word of `q`; a `#tag` word must be a hashtag of the post. Newest first. */
			search: {
				req: { q: string; limit?: number; cursor?: string };
				res: { posts: FeedPost[]; nextCursor?: string; errorDetails?: BaseErrorResponse };
			};
			/** Hashtags and accounts whose posts got the most likes and replies lately. */
			trending: {
				req: { limit?: number };
				res: {
					tags: TrendingTag[];
					users: TrendingUser[];
					errorDetails?: BaseErrorResponse;
				};
			};
			like: {
				req: { postID: string };
				res: { success: boolean; likeCount?: number; errorDetails?: BaseErrorResponse };
			};
			unlike: {
				req: { postID: string };
				res: { success: boolean; likeCount?: number; errorDetails?: BaseErrorResponse };
			};
			/** Records that the session account saw the post (idempotent). */
			view: {
				req: { postID: string };
				res: { success: boolean; errorDetails?: BaseErrorResponse };
			};
			metrics: {
				req: Record<string, never>;
				res: { metrics: PostMetrics; errorDetails?: BaseErrorResponse };
			};
			/** Hashtags matching `q` (start of the tag by default), most used first. */
			tags: {
				req: { q: string; match?: 'prefix' | 'contains'; limit?: number };
				res: { tags: SearchTag[]; errorDetails?: BaseErrorResponse };
			};
			byHashtag: {
				req: { tag: string; limit?: number; cursor?: string };
				res: { posts: FeedPost[]; nextCursor?: string; errorDetails?: BaseErrorResponse };
			};
			getOne: {
				req: { id: string };
				res: {
					success: boolean;
					post?: FeedPost;
					/** The chain of posts this one answers, the thread's first post first. */
					ancestors?: FeedPost[];
					errorDetails?: BaseErrorResponse;
				};
			};
			replies: {
				req: { postID: string; limit?: number; cursor?: string };
				res: { posts: FeedPost[]; nextCursor?: string; errorDetails?: BaseErrorResponse };
			};
			feed: {
				/** `nextCursor` (when more exist) goes back as `cursor` for the next page. `following` (login required) lists only accounts the viewer follows. */
				req: { limit?: number; cursor?: string; scope?: 'all' | 'following' };
				res: { posts: FeedPost[]; nextCursor?: string; errorDetails?: BaseErrorResponse };
			};
			byUser: {
				/** `posts` (default) lists an author's own posts, `replies` their replies. */
				req: {
					authorId: string;
					kind?: 'posts' | 'replies';
					limit?: number;
					cursor?: string;
				};
				res: { posts: FeedPost[]; nextCursor?: string; errorDetails?: BaseErrorResponse };
			};
		};
		follows: {
			follow: { res: { success: boolean; errorDetails?: BaseErrorResponse } };
			unfollow: { res: { success: boolean; errorDetails?: BaseErrorResponse } };
			stats: {
				res: { success: boolean; stats?: FollowStats; errorDetails?: BaseErrorResponse };
			};
		};
		notifications: {
			list: {
				res: {
					notifications: NotificationItem[];
					unreadCount: number;
					errorDetails?: BaseErrorResponse;
				};
			};
			/** Without `ids` everything is marked read; with them only those notifications. */
			readAll: {
				req: { ids?: string[] };
				res: { success: boolean; unreadCount?: number; errorDetails?: BaseErrorResponse };
			};
		};
		admin: {
			/** Moderators and admins: accounts by name (or email, for admins), optionally only blocked ones. */
			users: {
				req: { query?: string; banned?: boolean };
				res: { users: AdminUser[]; errorDetails?: BaseErrorResponse };
			};
			metrics: {
				req: Record<string, never>;
				res: { metrics: UserMetrics; errorDetails?: BaseErrorResponse };
			};
			/** Blocks an account: ends its sessions and bars its email from registering again. */
			ban: {
				req: { userName: string; reason?: string };
				res: { success: boolean; errorDetails?: BaseErrorResponse };
			};
			unban: {
				req: { userName: string };
				res: { success: boolean; errorDetails?: BaseErrorResponse };
			};
		};
		users: {
			/** Admin only: replaces the roles of an account (never one's own). */
			setRoles: {
				req: { roles: UserRole[] };
				res: { success: boolean; userData?: UserProfile; errorDetails?: BaseErrorResponse };
			};
			/** Accounts matching `query` in username or visible name (start of it by default), banned ones left out. */
			search: {
				req: { query: string; match?: 'prefix' | 'contains'; limit?: number };
				res: { users: UserProfile[]; errorDetails?: BaseErrorResponse };
			};
		};
		profile: {
			update: {
				req: ProfileUpdate;
				res: { success: boolean; userData?: UserProfile; errorDetails?: BaseErrorResponse };
			};
		};
		settings: {
			get: {
				res: {
					success: boolean;
					settings?: UserSettings;
					isStored?: boolean;
					errorDetails?: BaseErrorResponse;
				};
			};
			put: {
				req: UserSettings;
				res: {
					success: boolean;
					settings?: UserSettings;
					errorDetails?: BaseErrorResponse;
				};
			};
		};
		media: {
			upload: {
				res: { success: boolean; file?: MediaEntity; errorDetails?: BaseErrorResponse };
			};
		};
	};
}
