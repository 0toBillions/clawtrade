import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { groupService } from '../services/group.service';
import { authenticate } from '../middleware/auth';
import { rateLimiter, RateLimits } from '../middleware/rate-limit';

const CreateGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  requiredApprovals: z.number().int().min(1).max(20),
});

const JoinGroupSchema = z.object({
  contributionEth: z.string().regex(/^\d+(\.\d+)?$/),
});

const ProposeTradeSchema = z.object({
  tokenIn: z.string().regex(/^0x[a-fA-F0-9]{40}$/), // address(0) for ETH
  tokenOut: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amountIn: z.string().regex(/^\d+(\.\d+)?$/),
  minAmountOut: z.string().regex(/^\d+(\.\d+)?$/),
  dexRouter: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const ApproveTradeSchema = z.object({
  proposalId: z.string(),
});

const GetGroupsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export async function groupRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/groups
   * Create a new trading group (deploys vault contract)
   */
  fastify.post(
    '/',
    {
      preHandler: [authenticate, rateLimiter(RateLimits.WRITE)],
    },
    async (request, reply) => {
      try {
        const body = CreateGroupSchema.parse(request.body);
        const agentId = request.agent!.id;

        const group = await groupService.createGroup({
          creatorAgentId: agentId,
          name: body.name,
          description: body.description,
          requiredApprovals: body.requiredApprovals,
        });

        return reply.status(201).send({
          success: true,
          data: group,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: error.errors[0].message,
          });
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        request.log.error(error, 'Create group error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: errorMessage,
        });
      }
    }
  );

  /**
   * GET /api/v1/groups
   * Get all trading groups
   */
  fastify.get(
    '/',
    {
      preHandler: rateLimiter(RateLimits.READ),
    },
    async (request, reply) => {
      try {
        const query = GetGroupsQuerySchema.parse(request.query);

        const result = await groupService.getGroups({
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

        request.log.error(error, 'Get groups error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch groups',
        });
      }
    }
  );

  /**
   * GET /api/v1/groups/:groupId
   * Get group details
   */
  fastify.get(
    '/:groupId',
    {
      preHandler: rateLimiter(RateLimits.READ),
    },
    async (request, reply) => {
      try {
        const { groupId } = request.params as { groupId: string };

        const group = await groupService.getGroup(groupId);

        return reply.send({
          success: true,
          data: group,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('not found')) {
          return reply.status(404).send({
            error: 'Not Found',
            message: errorMessage,
          });
        }

        request.log.error(error, 'Get group error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch group',
        });
      }
    }
  );

  /**
   * POST /api/v1/groups/:groupId/join
   * Join a trading group with ETH contribution
   */
  fastify.post(
    '/:groupId/join',
    {
      preHandler: [authenticate, rateLimiter(RateLimits.WRITE)],
    },
    async (request, reply) => {
      try {
        const { groupId } = request.params as { groupId: string };
        const body = JoinGroupSchema.parse(request.body);
        const agentId = request.agent!.id;

        const member = await groupService.joinGroup({
          groupId,
          agentId,
          contributionEth: body.contributionEth,
        });

        return reply.status(201).send({
          success: true,
          data: member,
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

        request.log.error(error, 'Join group error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: errorMessage,
        });
      }
    }
  );

  /**
   * POST /api/v1/groups/:groupId/trades
   * Propose a trade in the group
   */
  fastify.post(
    '/:groupId/trades',
    {
      preHandler: [authenticate, rateLimiter(RateLimits.WRITE)],
    },
    async (request, reply) => {
      try {
        const { groupId } = request.params as { groupId: string };
        const body = ProposeTradeSchema.parse(request.body);
        const agentId = request.agent!.id;

        const proposal = await groupService.proposeTrade({
          groupId,
          proposerAgentId: agentId,
          tokenIn: body.tokenIn as `0x${string}`,
          tokenOut: body.tokenOut as `0x${string}`,
          amountIn: body.amountIn,
          minAmountOut: body.minAmountOut,
          dexRouter: body.dexRouter as `0x${string}`,
        });

        return reply.status(201).send({
          success: true,
          data: proposal,
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

        request.log.error(error, 'Propose trade error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: errorMessage,
        });
      }
    }
  );

  /**
   * GET /api/v1/groups/:groupId/trades
   * Get all trade proposals for a group
   */
  fastify.get(
    '/:groupId/trades',
    {
      preHandler: rateLimiter(RateLimits.READ),
    },
    async (request, reply) => {
      try {
        const { groupId } = request.params as { groupId: string };

        const group = await groupService.getGroup(groupId);

        return reply.send({
          success: true,
          data: {
            proposals: group.proposals,
            total: group.proposals.length,
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

        request.log.error(error, 'Get proposals error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch proposals',
        });
      }
    }
  );
}
