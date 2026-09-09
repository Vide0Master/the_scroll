import { prisma } from '../../lib/prisma';
import { hash, compareToHash } from '../../lib/bcrypt';

export async function checkAvailability(email?: string, username?: string) {
	const result: { emailAvailable?: boolean; usernameAvailable?: boolean } = {};

	if (email) {
		const user = await prisma.user.findFirst({
			where: { email },
		});
		result.emailAvailable = user === null;
	}

	if (username) {
		const user = await prisma.user.findFirst({
			where: { userName: username },
		});
		result.usernameAvailable = user === null;
	}

	return result;
}

export async function createUser(email: string, userName: string, passwordPlain: string) {
	const passwordHash = await hash(passwordPlain);
	return prisma.user.create({
		data: {
			email,
			userName,
			password: passwordHash,
		},
	});
}

export async function authenticateUser(loginName: string, passwordPlain: string) {
	const user = await prisma.user.findFirst({
		where: {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			OR: [{ userName: loginName }, { email: loginName }],
		},
	});

	if (!user) {
		return null;
	}

	const isPasswordValid = await compareToHash(passwordPlain, user.password);
	if (!isPasswordValid) {
		return null;
	}

	return user;
}

export async function createSession(userID: string) {
	return prisma.session.create({
		data: { userID },
	});
}
