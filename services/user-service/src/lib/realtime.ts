import { createRealtimeHub, redisUrlFromEnv } from '@the-scroll/backend-core';

/** One hub per process; it shares events between instances through Redis when it is configured. */
export const hub = createRealtimeHub(redisUrlFromEnv());

/** The channel a user's live notifications travel on. */
export const notificationChannel = (userID: string) => `notifications:${userID}`;
