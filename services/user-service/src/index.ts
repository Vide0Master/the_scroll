import process from 'node:process';
import { config } from './config/env';
import { buildApp } from './app';
import { verifyMailer } from './lib/mailer';

async function start() {
	const app = await buildApp();

	try {
		await app.listen({ port: config.port, host: '0.0.0.0' });
		console.log(`Users service running on port ${config.port}`);
		await verifyMailer((message) => app.log.info(message));
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
}

start();
