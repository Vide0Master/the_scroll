import { prisma as userDb } from '../../services/user-service/src/lib/prisma';
import { expect, test } from '../support/fixtures';

test.describe('role badges on a profile', () => {
	test('show one badge per role of the account', async ({ userPage, account, otherAccount }) => {
		await userDb.user.update({
			where: { userID: otherAccount.userID },
			data: { roles: ['ADMIN', 'MODERATOR'] },
		});

		await userPage.goto(`/u/${otherAccount.userName}`);

		const badges = userPage.getByRole('listitem').filter({ hasText: /^(Admin|Moderator)$/ });
		await expect(badges).toHaveText(['Admin', 'Moderator']);

		await userPage.goto(`/u/${account.userName}`);
		await expect(userPage.getByRole('main').getByText(`@${account.userName}`)).toBeVisible();
		await expect(userPage.getByText('Admin', { exact: true })).toHaveCount(0);
		await expect(userPage.getByText('Moderator', { exact: true })).toHaveCount(0);
	});
});
