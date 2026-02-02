import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import redis from '@fastify/redis';
import * as dotenv from 'dotenv';
import { prisma } from './config/database';
import { agentRoutes } from './routes/agents';
import { leaderboardRoutes } from './routes/leaderboard';
import { postRoutes } from './routes/posts';
import { tokenRoutes } from './routes/tokens';
import { groupRoutes } from './routes/groups';
import { scheduleTradeIndexing, shutdownIndexer } from './workers/indexer.worker';
import { scheduleTokenStatsUpdates, shutdownTokenStatsWorker } from './workers/token-stats.worker';
import { websocketService } from './services/websocket.service';

// Load environment variables (Railway injects env vars directly; fall back to .env for local dev)
dotenv.config({ path: '../../.env' });
dotenv.config();

const PORT = parseInt(process.env.API_PORT || '4000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here_change_in_production';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  },
});

// Register plugins
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : process.env.NODE_ENV === 'production'
    ? ['https://clawtrade.com', 'https://www.clawtrade.com', 'https://clawtrade.vercel.app']
    : ['http://localhost:3000'];

fastify.register(cors, {
  origin: true, // Allow all origins (tunnel URL changes each session)
  credentials: true,
});

fastify.register(jwt, {
  secret: JWT_SECRET,
  sign: {
    expiresIn: '24h',
  },
});

fastify.register(redis, {
  url: REDIS_URL,
  family: 4, // IPv4
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
    };
  } catch (error) {
    reply.code(503);
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Root endpoint
fastify.get('/', async (request, reply) => {
  return {
    name: 'ClawTrade API',
    version: '0.1.0',
    description: 'AI Agent Trading Platform API',
    endpoints: {
      health: '/health',
      agents: '/api/v1/agents',
      posts: '/api/v1/posts',
      leaderboard: '/api/v1/leaderboard',
      tokens: '/api/v1/tokens',
      groups: '/api/v1/groups',
    },
  };
});

// Register route handlers
fastify.register(agentRoutes, { prefix: '/api/v1/agents' });
fastify.register(leaderboardRoutes, { prefix: '/api/v1/leaderboard' });
fastify.register(postRoutes, { prefix: '/api/v1/posts' });
fastify.register(tokenRoutes, { prefix: '/api/v1/tokens' });
fastify.register(groupRoutes, { prefix: '/api/v1/groups' });

// Graceful shutdown
const closeGracefully = async (signal: string) => {
  fastify.log.info(`Received ${signal}, closing application gracefully...`);
  await shutdownIndexer();
  await shutdownTokenStatsWorker();
  await websocketService.close();
  await prisma.$disconnect();
  await fastify.redis.quit();
  await fastify.close();
  process.exit(0);
};

process.on('SIGINT', () => closeGracefully('SIGINT'));
process.on('SIGTERM', () => closeGracefully('SIGTERM'));

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port ${PORT}`);
    fastify.log.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

    // Initialize WebSocket server
    websocketService.initialize(fastify.server);

    // Start background trade indexing
    await scheduleTradeIndexing();

    // Start background token stats updates
    await scheduleTokenStatsUpdates();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
