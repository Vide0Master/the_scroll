import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';

const corsPlugin: FastifyPluginAsync = async (fastify) => {
	await fastify.register(fastifyCors, {
		origin: true,
		credentials: true,
	});
};

export default fp(corsPlugin);
