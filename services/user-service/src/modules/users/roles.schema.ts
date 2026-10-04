import { z } from 'zod';
import { USER_ROLES } from '@the-scroll/types';

export const rolesUpdateSchema = z.strictObject({
	roles: z
		.array(z.enum(USER_ROLES))
		// A generous cap against absurd bodies; duplicates are collapsed into a set below.
		.max(20)
		.transform((roles) => [...new Set(roles)]),
});
