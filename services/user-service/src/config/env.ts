import 'dotenv/config';
import process from 'node:process';

const port = Number(process.env.PORT_USERS_SERVICE);
const cookieSecret = process.env.USER_SERVICE_COOKIE_SECRET;
const isProd = process.env.NODE_ENV === 'production';

if (!port || Number.isNaN(port)) {
	throw new Error('PORT_USERS_SERVICE is undefined or invalid');
}

if (!cookieSecret) {
	throw new Error('USER_SERVICE_COOKIE_SECRET is undefined');
}

const smtpHost = process.env.SMTP_HOST;

if (isProd && !smtpHost) {
	throw new Error('SMTP_HOST is undefined');
}

export const config = {
	port,
	cookieSecret,
	isProd,
	internalMediaServiceUrl: process.env.INTERNAL_MEDIA_SERVICE_URL,
	internalApiToken: process.env.INTERNAL_API_TOKEN,
	appPublicUrl: process.env.APP_PUBLIC_URL || 'http://localhost:3000',
	smtp: {
		host: smtpHost,
		port: Number(process.env.SMTP_PORT) || 587,
		user: process.env.SMTP_USER,
		password: process.env.SMTP_PASSWORD,
		from: process.env.SMTP_FROM || 'The Scroll <no-reply@localhost>',
	},
};
