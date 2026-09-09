import { prisma } from '../../lib/prisma';

export interface AuthorProfile {
	userID: string;
	userName: string;
	visibleName: string | null;
}

export async function createPost(authorID: string, content: string, mediaUrls: string[] = []) {
	return prisma.post.create({
		data: {
			authorID,
			content,
			media: mediaUrls,
		},
	});
}

export async function getFeed(limit: number = 20, userServiceUrl?: string) {
	const posts = await prisma.post.findMany({
		take: limit,
		orderBy: {
			createdAt: 'desc',
		},
	});

	if (!userServiceUrl || posts.length === 0) {
		return posts.map((post) => ({ ...post, author: null }));
	}

	const uniqueAuthorIDs = Array.from(new Set(posts.map((post) => post.authorID)));
	let authorMap = new Map<string, AuthorProfile>();

	try {
		const response = await fetch(`${userServiceUrl}/users/by-ids`, {
			method: 'POST',
			headers: {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ userIDs: uniqueAuthorIDs }),
		});

		if (response.ok) {
			const data = (await response.json()) as { users: AuthorProfile[] };
			if (data && Array.isArray(data.users)) {
				authorMap = new Map(data.users.map((user) => [user.userID, user]));
			}
		}
	} catch (error) {
		console.error('Failed to resolve author details:', error);
	}

	return posts.map((post) => ({
		...post,
		author: authorMap.get(post.authorID) || null,
	}));
}
