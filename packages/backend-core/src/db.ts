import { PrismaPg } from '@prisma/adapter-pg';

export interface DatabaseClientConstructor<T> {
	new (options: { adapter: PrismaPg }): T;
}

export function createDatabaseClient<T>(
	ClientConstructor: DatabaseClientConstructor<T>,
	connectionString?: string,
): T {
	if (!connectionString) {
		throw new Error('Database connection URL is not defined');
	}

	const adapter = new PrismaPg({ connectionString });
	return new ClientConstructor({ adapter });
}
