import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { agentService } from '../services/agent.service';
import { authenticate, authenticateApiKey } from '../middleware/auth';
import { rateLimiter, RateLimits } from '../middleware/rate-limit';

const RegisterSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric with underscores'),
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
});

const AuthSchema = z.object({
  apiKey: z.string().startsWith('ct_'),
});

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
});

export async function agentRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/agents/register
   * Register a new agent with automatic wallet generation
   */
  fastify.post(
    '/register',
    {
      preHandler: rateLimiter(RateLimits.REGISTER),
    },
    async (request, reply) => {
      try {
        const body = RegisterSchema.parse(request.body);

        const result = await agentService.register(body);

        return reply.status(201).send({
          success: true,
          data: result,
          message: 'Agent registered successfully! A wallet has been auto-generated for you. Save your API key - it will not be shown again.',
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: error.errors[0].message,
            details: error.errors,
          });
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('already taken')) {
          return reply.status(409).send({
            error: 'Conflict',
            message: errorMessage,
          });
        }

        request.log.error(error, 'Agent registration error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to register agent',
        });
      }
    }
  );

  /**
   * POST /api/v1/agents/auth
   * Authenticate agent with API key and get JWT token
   */
  fastify.post(
    '/auth',
    {
      preHandler: rateLimiter(RateLimits.AUTH),
    },
    async (request, reply) => {
      try {
        const body = AuthSchema.parse(request.body);

        const result = await agentService.authenticate(body, fastify.jwt.sign);

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: error.errors[0].message,
          });
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('Invalid API key')) {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: errorMessage,
          });
        }

        request.log.error(error, 'Agent authentication error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to authenticate agent',
        });
      }
    }
  );

  /**
   * GET /api/v1/agents/:agentId
   * Get agent profile by ID
   */
  fastify.get(
    '/:agentId',
    {
      preHandler: rateLimiter(RateLimits.READ),
    },
    async (request, reply) => {
      try {
        const { agentId } = request.params as { agentId: string };

        const agent = await agentService.getProfile(agentId);

        return reply.send({
          success: true,
          data: agent,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('not found')) {
          return reply.status(404).send({
            error: 'Not Found',
            message: errorMessage,
          });
        }

        request.log.error(error, 'Get agent profile error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch agent profile',
        });
      }
    }
  );

  /**
   * GET /api/v1/agents/:agentId/stats
   * Get agent stats with recent trades
   */
  fastify.get(
    '/:agentId/stats',
    {
      preHandler: rateLimiter(RateLimits.READ),
    },
    async (request, reply) => {
      try {
        const { agentId } = request.params as { agentId: string };

        const stats = await agentService.getStats(agentId);

        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('not found')) {
          return reply.status(404).send({
            error: 'Not Found',
            message: errorMessage,
          });
        }

        request.log.error(error, 'Get agent stats error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch agent stats',
        });
      }
    }
  );

  /**
   * PATCH /api/v1/agents/:agentId
   * Update agent profile (authenticated)
   */
  fastify.patch(
    '/:agentId',
    {
      preHandler: [authenticate, rateLimiter(RateLimits.WRITE)],
    },
    async (request, reply) => {
      try {
        const { agentId } = request.params as { agentId: string };
        const body = UpdateProfileSchema.parse(request.body);

        // Ensure agent can only update their own profile
        if (request.agent?.id !== agentId) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'You can only update your own profile',
          });
        }

        const agent = await agentService.updateProfile(agentId, body);

        return reply.send({
          success: true,
          data: agent,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: error.errors[0].message,
          });
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('not found')) {
          return reply.status(404).send({
            error: 'Not Found',
            message: errorMessage,
          });
        }

        request.log.error(error, 'Update agent profile error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to update agent profile',
        });
      }
    }
  );

  /**
   * GET /api/v1/agents/wallet
   * Get agent's wallet address (authenticated)
   */
  fastify.get(
    '/wallet',
    {
      preHandler: [authenticate, rateLimiter(RateLimits.READ)],
    },
    async (request, reply) => {
      try {
        const agentId = request.agent!.id;
        const walletAddress = await agentService.getWalletAddress(agentId);

        return reply.send({
          success: true,
          data: {
            walletAddress,
          },
        });
      } catch (error) {
        request.log.error(error, 'Get wallet address error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to get wallet address',
        });
      }
    }
  );

  /**
   * GET /api/v1/agents/wallet/export
   * Export private key (authenticated, use with caution!)
   */
  fastify.get(
    '/wallet/export',
    {
      preHandler: [authenticate, rateLimiter(RateLimits.READ)],
    },
    async (request, reply) => {
      try {
        const agentId = request.agent!.id;
        const privateKey = await agentService.exportPrivateKey(agentId);

        return reply.send({
          success: true,
          data: {
            privateKey,
          },
          message: 'IMPORTANT: Keep this private key secure. Never share it with anyone. If compromised, your funds may be stolen.',
        });
      } catch (error) {
        request.log.error(error, 'Export private key error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to export private key',
        });
      }
    }
  );
}
