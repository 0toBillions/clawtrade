import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticatedRequest } from './auth';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix: string;
}

/**
 * Redis-based sliding window rate limiter
 */
export function rateLimiter(config: RateLimitConfig) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      if (!request.agent) {
        // Rate limit by IP for unauthenticated requests
        const ip = request.ip;
        const key = `${config.keyPrefix}:ip:${ip}`;
        await checkRateLimit(request, reply, key, config);
      } else {
        // Rate limit by agent ID for authenticated requests
        const key = `${config.keyPrefix}:agent:${request.agent.id}`;
        await checkRateLimit(request, reply, key, config);
      }
    } catch (error) {
      request.log.error(error, 'Rate limit error');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Rate limiting failed',
      });
    }
  };
}

async function checkRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  key: string,
  config: RateLimitConfig
) {
  const redis = request.server.redis;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Use Redis sorted set for sliding window
  const multi = redis.multi();

  // Remove old entries outside the window
  multi.zremrangebyscore(key, 0, windowStart);

  // Count current requests in window
  multi.zcard(key);

  // Add current request
  multi.zadd(key, now, `${now}:${Math.random()}`);

  // Set expiry on key
  multi.expire(key, Math.ceil(config.windowMs / 1000));

  const results = await multi.exec();
  const currentCount = results?.[1]?.[1] as number;

  if (currentCount >= config.maxRequests) {
    const oldestEntry = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const resetTime = oldestEntry.length > 0
      ? parseInt(oldestEntry[1]) + config.windowMs
      : now + config.windowMs;

    const retryAfter = Math.ceil((resetTime - now) / 1000);

    return reply
      .status(429)
      .header('Retry-After', retryAfter.toString())
      .header('X-RateLimit-Limit', config.maxRequests.toString())
      .header('X-RateLimit-Remaining', '0')
      .header('X-RateLimit-Reset', resetTime.toString())
      .send({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter,
      });
  }

  // Add rate limit headers
  reply.header('X-RateLimit-Limit', config.maxRequests.toString());
  reply.header('X-RateLimit-Remaining', (config.maxRequests - currentCount - 1).toString());
  reply.header('X-RateLimit-Reset', (now + config.windowMs).toString());
}

// Preset rate limit configurations
export const RateLimits = {
  // 1000 reads per hour for authenticated agents
  READ: {
    maxRequests: 1000,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyPrefix: 'ratelimit:read',
  },
  // 100 writes per hour for authenticated agents
  WRITE: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyPrefix: 'ratelimit:write',
  },
  // 10 registration attempts per hour per IP
  REGISTER: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyPrefix: 'ratelimit:register',
  },
  // 20 auth attempts per hour per IP
  AUTH: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyPrefix: 'ratelimit:auth',
  },
};
