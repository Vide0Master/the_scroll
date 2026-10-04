import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import process from 'node:process';

const usersPort = process.env.PORT_USERS_SERVICE || process.env.PORT_USER_SERVICE || 3001;
const postsPort = process.env.PORT_POSTS_SERVICE || 3002;
const mediaPort = process.env.PORT_MEDIA_SERVICE || 3003;

export default defineConfig({
	plugins: [react(), tailwindcss(), babel({ presets: [reactCompilerPreset()] })],
	server: {
		port: Number(process.env.PORT_FRONTEND) || 3000,
		strictPort: true,
		proxy: {
			'/api/auth': {
				target: `http://localhost:${usersPort}`,
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, ''),
			},
			'/api/users': {
				target: `http://localhost:${usersPort}`,
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, ''),
			},
			'/api/notifications': {
				target: `http://localhost:${usersPort}`,
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, ''),
			},
			'/api/posts': {
				target: `http://localhost:${postsPort}`,
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, ''),
			},
			'/api/media': {
				target: `http://localhost:${mediaPort}`,
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, ''),
			},
		},
	},
});
