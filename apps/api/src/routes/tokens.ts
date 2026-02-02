import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { tokenService } from '../services/token.service';
import { authenticate } from '../middleware/auth';
import { rateLimiter, RateLimits } from '../middleware/rate-limit';

const LaunchTokenSchema = z.object({
  name: z.string().min(1).max(50),
  symbol: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/),
  image: z.string().url().optional(),
  description: z.string().max(500).optional(),
  initialBuyEth: z.string().regex(/^\d+(\.\d+)?$/).optional(),
});

const GetTokensQuerySchema = z.object({
  agentId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export async function tokenRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/tokens/launch
   * Launch a new ERC20 token with Uniswap liquidity pool
   */
  fastify.post(
    '/launch',
    {
      preHandler: [authenticate, rateLimiter(RateLimits.WRITE)],
    },
    async (request, reply) => {
      try {
        const body = LaunchTokenSchema.parse(request.body);
        const agentId = request.agent!.id;

        const token = await tokenService.launchToken({
          agentId,
          name: body.name,
          symbol: body.symbol,
          image: body.image,
          description: body.description,
          initialBuyEth: body.initialBuyEth,
        });

        return reply.status(201).send({
          success: true,
          data: token,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: error.errors[0].message,
          });
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        request.log.error(error, 'Launch token error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: errorMessage,
        });
      }
    }
  );

  /**
   * GET /api/v1/tokens
   * Get all launched tokens with optional filters
   */
  fastify.get(
    '/',
    {
      preHandler: rateLimiter(RateLimits.READ),
    },
    async (request, reply) => {
      try {
        const query = GetTokensQuerySchema.parse(request.query);

        const result = await tokenService.getTokens({
          agentId: query.agentId,
          limit: query.limit,
          offset: query.offset,
        });

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

        request.log.error(error, 'Get tokens error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch tokens',
        });
      }
    }
  );

  /**
   * GET /api/v1/tokens/:tokenAddress
   * Get token details by address
   */
  fastify.get(
    '/:tokenAddress',
    {
      preHandler: rateLimiter(RateLimits.READ),
    },
    async (request, reply) => {
      try {
        const { tokenAddress } = request.params as { tokenAddress: string };

        // Validate address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: 'Invalid token address format',
          });
        }

        const token = await tokenService.getToken(tokenAddress);

        return reply.send({
          success: true,
          data: token,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('not found')) {
          return reply.status(404).send({
            error: 'Not Found',
            message: errorMessage,
          });
        }

        request.log.error(error, 'Get token error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch token',
        });
      }
    }
  );

  /**
   * GET /api/v1/tokens/:tokenAddress/stats
   * Get real-time token statistics
   */
  fastify.get(
    '/:tokenAddress/stats',
    {
      preHandler: rateLimiter(RateLimits.READ),
    },
    async (request, reply) => {
      try {
        const { tokenAddress } = request.params as { tokenAddress: string };

        const token = await tokenService.getToken(tokenAddress);

        // Return simplified stats
        return reply.send({
          success: true,
          data: {
            tokenAddress: token.tokenAddress,
            symbol: token.symbol,
            name: token.name,
            priceUsd: token.priceUsd,
            marketCapUsd: token.marketCapUsd,
            totalSupply: token.totalSupply,
            holders: token.holders,
            liquidityUsd: token.initialLiquidityUsd,
            createdAt: token.createdAt,
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('not found')) {
          return reply.status(404).send({
            error: 'Not Found',
            message: errorMessage,
          });
        }

        request.log.error(error, 'Get token stats error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch token stats',
        });
      }
    }
  );
}
