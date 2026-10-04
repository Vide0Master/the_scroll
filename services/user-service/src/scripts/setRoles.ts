import process from 'node:process';
import { USER_ROLES, type UserRole } from '@the-scroll/types';
import { prisma } from '../lib/prisma';

// Gives an account its roles from the command line; the way to make the first admin.
//   npm run role:set -- <userName> [ADMIN,MODERATOR]      (no roles = clear them)
const [userName, list = ''] = process.argv.slice(2);
const roles = list.split(',').filter(Boolean) as UserRole[];

if (!userName || roles.some((role) => !USER_ROLES.includes(role))) {
	console.error(`Usage: role:set -- <userName> [${USER_ROLES.join(',')}]`);
	process.exit(1);
}

const { count } = await prisma.user.updateMany({ where: { userName }, data: { roles } });
console.log(
	count === 0 ? `No user "${userName}".` : `${userName}: ${roles.join(', ') || '(no roles)'}`,
);
process.exit(count === 0 ? 1 : 0);
