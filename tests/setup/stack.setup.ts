import net from 'node:net';
import { test } from '@playwright/test';
import { SERVICE_PORTS } from '../support/env';

function canConnect(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = net.connect({ port, host: 'localhost' });
		socket.once('connect', () => {
			socket.destroy();
			resolve(true);
		});
		socket.once('error', () => resolve(false));
	});
}

async function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		if (await canConnect(port)) {
			return true;
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	return false;
}

// Runs before the api/e2e projects: fails with a readable reason instead of a wall of
// connection errors when the containers or services aren't up.
test('database, Redis and services are reachable', async () => {
	test.setTimeout(90_000);

	const containers: [string, number][] = [
		['Postgres', Number(process.env.POSTGRES_PORT)],
		['Redis', Number(process.env.REDIS_PORT)],
	];

	for (const [name, port] of containers) {
		if (!port || !(await canConnect(port))) {
			throw new Error(`${name} is not reachable on port ${port}. Run: npm run test:up`);
		}
	}

	for (const [name, port] of Object.entries(SERVICE_PORTS)) {
		if (!(await waitForPort(port, 60_000))) {
			throw new Error(`${name}-service did not start on port ${port}.`);
		}
	}
});
