export const FRONTEND_PORT = process.env.PORT_FRONTEND ?? '3020';
export const BASE_URL = `http://localhost:${FRONTEND_PORT}`;
/** The same `/api/<service>/...` paths the browser uses; the Vite proxy strips `/api`. */
export const API_URL = `${BASE_URL}/api`;

export const SERVICE_PORTS = {
	users: Number(process.env.PORT_USERS_SERVICE ?? 3021),
	posts: Number(process.env.PORT_POSTS_SERVICE ?? 3022),
	media: Number(process.env.PORT_MEDIA_SERVICE ?? 3023),
};
