import 'dotenv/config';
import process from 'node:process';

const port = Number(process.env.PORT_POSTS_SERVICE);
const cookieSecret = process.env.COOKIE_SECRET || process.env.USER_SERVICE_COOKIE_SECRET;

if (!port || Number.isNaN(port)) {
	throw new Error('PORT_POSTS_SERVICE is undefined or invalid');
}

if (!cookieSecret) {
	throw new Error('COOKIE_SECRET is undefined');
}

export const config = {
	port,
	cookieSecret,
	userServiceUrl: process.env.USER_SERVICE_URL || 'http://127.0.0.1:3001',
	isProd: process.env.NODE_ENV === 'production',
};
