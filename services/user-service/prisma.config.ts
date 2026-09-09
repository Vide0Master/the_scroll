import { createPrismaConfig } from '@the-scroll/backend-core/prismaConfig';

export default createPrismaConfig({
	envVarName: 'POSTGRES_USER_SERVICE_DATABASE_URL',
});
