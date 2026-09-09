import { prisma } from '../../lib/prisma';

export async function getSessionUser(sessionID: string) {
	const session = await prisma.session.findUnique({
		where: { sessionID },
		include: {
			user: {
				select: {
					userID: true,
					userName: true,
					visibleName: true,
					createdAt: true,
				},
			},
		},
	});

	return session ? session.user : null;
}

export async function getUserByUsername(rawUserName: string) {
	const cleanName = rawUserName.replace(/^@/, '');
	return prisma.user.findUnique({
		where: { userName: cleanName },
		select: {
			userID: true,
			userName: true,
			visibleName: true,
			createdAt: true,
		},
	});
}

export async function getUsersByIds(userIDs: string[]) {
	return prisma.user.findMany({
		where: {
			userID: {
				in: userIDs,
			},
		},
		select: {
			userID: true,
			userName: true,
			visibleName: true,
			createdAt: true,
		},
	});
}
