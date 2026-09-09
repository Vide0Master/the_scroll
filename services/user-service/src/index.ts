import process from 'node:process';
import { config } from './config/env';
import { buildApp } from './app';

async function start() {
	const app = await buildApp();

	try {
		await app.listen({ port: config.port, host: '0.0.0.0' });
		console.log(`Users service running on port ${config.port}`);
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
}

start();
