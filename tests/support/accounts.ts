import { randomUUID } from 'node:crypto';
import { hash } from '../../services/user-service/src/lib/bcrypt';
import { prisma as userDb } from '../../services/user-service/src/lib/prisma';
import { prisma as postDb } from '../../services/post-service/src/lib/prisma';
import { internalHeaders, mediaInternalUrl } from './internal';

export interface TestAccount {
	userID: string;
	userName: string;
	email: string;
	password: string;
}

/**
 * Creates a confirmed user straight in the dev database. Registration needs an emailed link a
 * test can't read, so it's covered at the validation level in the api tests instead. Going
 * through the services' own Prisma clients keeps the Redis query cache coherent.
 */
export async function createAccount(): Promise<TestAccount> {
	const id = randomUUID().slice(0, 8);
	const account = {
		userName: `e2e_${id}`,
		email: `e2e_${id}@example.test`,
		password: `pw-${randomUUID()}`,
	};

	const user = await userDb.user.create({
		data: {
			userName: account.userName,
			email: account.email,
			password: await hash(account.password),
		},
	});

	return { ...account, userID: user.userID };
}

/** Removes everything a test account created, in every service database. */
export async function deleteAccount(account: TestAccount): Promise<void> {
	// Release the account's files first and sweep them, so tests leave nothing in uploads/.
	const posts = await postDb.post.findMany({
		where: { authorID: account.userID },
		select: { postID: true },
	});
	const usages = [
		...posts.map((post) => ({ kind: 'post', refID: post.postID, urls: [] })),
		{ kind: 'avatar', refID: account.userID, urls: [] },
		{ kind: 'banner', refID: account.userID, urls: [] },
	];

	for (let i = 0; i < usages.length; i += 10) {
		await fetch(mediaInternalUrl('usage'), {
			method: 'PUT',
			// eslint-disable-next-line @typescript-eslint/naming-convention
			headers: { ...internalHeaders, 'Content-Type': 'application/json' },
			body: JSON.stringify({ ownerID: account.userID, usages: usages.slice(i, i + 10) }),
		});
	}

	await fetch(mediaInternalUrl('sweep'), {
		method: 'POST',
		// eslint-disable-next-line @typescript-eslint/naming-convention
		headers: { ...internalHeaders, 'Content-Type': 'application/json' },
		body: JSON.stringify({ dryRun: false, graceMs: 0, ownerID: account.userID }),
	});

	await postDb.post.deleteMany({ where: { authorID: account.userID } });
	await userDb.session.deleteMany({ where: { userID: account.userID } });
	// UserSettings go with the user (onDelete: Cascade).
	await userDb.user.deleteMany({ where: { userID: account.userID } });
}
