import 'dotenv/config';
import process from 'node:process';

const port = Number(process.env.PORT_USERS_SERVICE);
const cookieSecret = process.env.USER_SERVICE_COOKIE_SECRET;

if (!port || Number.isNaN(port)) {
	throw new Error('PORT_USERS_SERVICE is undefined or invalid');
}

if (!cookieSecret) {
	throw new Error('USER_SERVICE_COOKIE_SECRET is undefined');
}

export const config = {
	port,
	cookieSecret,
	isProd: process.env.NODE_ENV === 'production',
};
