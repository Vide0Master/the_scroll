import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import { config } from '../config/env';

const cookiePlugin: FastifyPluginAsync = async (fastify) => {
	await fastify.register(fastifyCookie, {
		secret: config.cookieSecret,
	});
};

export default fp(cookiePlugin);
