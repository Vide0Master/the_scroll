import process from 'node:process';
import { hash } from '../../services/user-service/src/lib/bcrypt';
import { prisma as userDb } from '../../services/user-service/src/lib/prisma';
import { prisma as postDb } from '../../services/post-service/src/lib/prisma';

// Fake activity for trying out trends and metrics on the dev database.
//   npm run seed:activity            adds 1000 accounts (seed_0001…) with posts, replies, likes, views
//   npm run seed:activity -- --clean removes everything this script made (only `seed_` accounts)
// A fixed random seed makes every run produce the same shape, so the expected top tags are known.

const USERS = 1000;
const AUTHORS = 50;
const POSTS_PER_AUTHOR = 4;
const DAY_MS = 24 * 60 * 60 * 1000;
const PREFIX = 'seed_';
// Hot tags get more likes the earlier they are in the list (Zipf-like); `seedoldbuzz` had all its
// activity 5–8 days ago, so it must NOT show up in trends.
const HOT_TAGS = ['seedalpha', 'seedbeta', 'seedgamma', 'seeddelta', 'seedepsilon', 'seedzeta'];
const OLD_TAG = 'seedoldbuzz';

let state = 42;
/** Small deterministic PRNG (mulberry32), so runs are reproducible. */
function random() {
	state = (state + 0x6d2b79f5) | 0;
	let t = Math.imul(state ^ (state >>> 15), 1 | state);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
const name = (index: number) => `${PREFIX}${String(index).padStart(4, '0')}`;

async function clean() {
	const users = await userDb.user.findMany({
		where: { userName: { startsWith: PREFIX } },
		select: { userID: true },
	});
	const ids = users.map((user) => user.userID);

	// Their likes/views on real posts go too; their posts take likes, views and tags along.
	await postDb.postLike.deleteMany({ where: { userID: { in: ids } } });
	await postDb.postView.deleteMany({ where: { userID: { in: ids } } });
	// Replies to seed posts from real accounts would block the delete otherwise (parent link).
	const posts = await postDb.post.findMany({
		where: { authorID: { in: ids } },
		select: { postID: true },
	});
	await postDb.post.deleteMany({ where: { parentPostID: { in: posts.map((p) => p.postID) } } });
	const { count } = await postDb.post.deleteMany({ where: { authorID: { in: ids } } });
	await userDb.user.deleteMany({ where: { userID: { in: ids } } });
	console.log(`Removed ${ids.length} accounts and ${count} posts.`);
}

async function seed() {
	if (await userDb.user.findFirst({ where: { userName: name(1) } })) {
		console.error('Already seeded. Run with --clean first.');
		process.exit(1);
	}

	const password = await hash(`seed-${Math.random()}`);
	await userDb.user.createMany({
		data: Array.from({ length: USERS }, (_, i) => ({
			userName: name(i + 1),
			visibleName: `Seed User ${i + 1}`,
			email: `${name(i + 1)}@example.test`,
			password,
		})),
	});
	const users = await userDb.user.findMany({
		where: { userName: { startsWith: PREFIX } },
		orderBy: { userName: 'asc' },
		select: { userID: true },
	});
	const ids = users.map((user) => user.userID);
	const authors = ids.slice(0, AUTHORS);
	const now = Date.now();

	// Posts: recent ones carry a hot tag (the first tags are picked most often), old ones the old tag.
	const posts: { postID: string; authorID: string; weight: number; at: number }[] = [];
	const postRows: { authorID: string; content: string; createdAt: Date }[] = [];
	const tagOf: string[] = [];

	for (const authorID of authors) {
		for (let n = 0; n < POSTS_PER_AUTHOR; n++) {
			const rank = Math.floor(HOT_TAGS.length * random() ** 2);
			const at = now - random() * 3 * DAY_MS;
			postRows.push({
				authorID,
				content: `Seed post about #${HOT_TAGS[rank]}`,
				createdAt: new Date(at),
			});
			tagOf.push(HOT_TAGS[rank]);
		}
	}
	for (let n = 0; n < 40; n++) {
		const at = now - (5 + random() * 3) * DAY_MS;
		postRows.push({
			authorID: pick(authors),
			content: `Seed post about #${OLD_TAG}`,
			createdAt: new Date(at),
		});
		tagOf.push(OLD_TAG);
	}

	const created = await Promise.all(
		postRows.map((row) => postDb.post.create({ data: row, select: { postID: true } })),
	);
	created.forEach(({ postID }, i) => {
		const row = postRows[i];
		posts.push({
			postID,
			authorID: row.authorID,
			// A few posts are much more popular than the rest.
			weight: 1 / (1 + (i % 25)),
			at: row.createdAt.getTime(),
		});
	});
	await postDb.postTag.createMany({
		data: created.map(({ postID }, i) => ({ postID, tag: tagOf[i] })),
	});

	const total = posts.reduce((sum, post) => sum + post.weight, 0);
	const pickPost = () => {
		let roll = random() * total;
		return posts.find((post) => (roll -= post.weight) <= 0) ?? posts[0];
	};

	// Likes and views: every account reacts to several posts, mostly the popular ones.
	const likes = new Map<string, { postID: string; userID: string; createdAt: Date }>();
	const views = new Map<string, { postID: string; userID: string; createdAt: Date }>();

	for (const userID of ids) {
		for (let n = 0; n < 8; n++) {
			const post = pickPost();
			const isOld = post.at < now - 4 * DAY_MS;
			// Old-tag posts were liked back when they were fresh; the rest inside the window.
			const createdAt = new Date(
				isOld ? post.at + random() * DAY_MS : now - random() * 3 * DAY_MS,
			);
			likes.set(`${post.postID}:${userID}`, { postID: post.postID, userID, createdAt });
		}
		for (let n = 0; n < 15; n++) {
			const post = pickPost();
			views.set(`${post.postID}:${userID}`, {
				postID: post.postID,
				userID,
				createdAt: new Date(now - random() * 3 * DAY_MS),
			});
		}
	}
	// One author likes all of their own posts: must not count towards their score.
	for (const post of posts.filter((p) => p.authorID === authors[0])) {
		likes.set(`${post.postID}:${authors[0]}`, {
			postID: post.postID,
			userID: authors[0],
			createdAt: new Date(now),
		});
	}
	await postDb.postLike.createMany({ data: [...likes.values()], skipDuplicates: true });
	await postDb.postView.createMany({ data: [...views.values()], skipDuplicates: true });

	// Replies to the popular posts from random accounts.
	const recent = posts.filter((post) => post.at > now - 3 * DAY_MS);
	const replies = Array.from({ length: 300 }, () => {
		const parent = recent[Math.floor(recent.length * random() ** 2)];
		return {
			authorID: pick(ids),
			parentPostID: parent.postID,
			content: 'Seed reply',
			createdAt: new Date(Math.max(parent.at, now - random() * 3 * DAY_MS)),
		};
	});
	await postDb.post.createMany({ data: replies });

	// Follows: everyone follows a few authors.
	const follows = new Map<string, { followerID: string; followeeID: string }>();
	for (const followerID of ids) {
		for (let n = 0; n < 3; n++) {
			const followeeID = pick(authors);
			if (followeeID !== followerID) {
				follows.set(`${followerID}:${followeeID}`, { followerID, followeeID });
			}
		}
	}
	await userDb.follow.createMany({ data: [...follows.values()], skipDuplicates: true });

	console.log(
		`Seeded ${ids.length} accounts, ${created.length + replies.length} posts, ` +
			`${likes.size} likes, ${views.size} views, ${follows.size} follows.`,
	);
	console.log(
		`Expect #${HOT_TAGS[0]} on top of trends and no #${OLD_TAG}. Trends refresh within 60 s.`,
	);
}

await (process.argv.includes('--clean') ? clean() : seed());
process.exit(0);
