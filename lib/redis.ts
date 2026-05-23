import { Redis } from "@upstash/redis";

// Upstash Redis client singleton
// Used for idempotency key storage with automatic TTL expiry
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
