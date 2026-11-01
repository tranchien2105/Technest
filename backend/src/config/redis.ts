import { createClient } from "redis";

export function createRedis(url: string) {
  return createClient({
    url,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 2000,
      reconnectStrategy: (retries) => (retries >= 3 ? false : Math.min(100 * 2 ** retries, 1000)),
    },
  });
}
