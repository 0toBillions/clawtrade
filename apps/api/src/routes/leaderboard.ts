import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { agentService } from '../services/agent.service';
import { rateLimiter, RateLimits } from '../middleware/rate-limit';

const LeaderboardQuerySchema = z.object({
  metric: z.enum(['profit', 'volume', 'winRate']).default('profit'),
  limit: z.coerce.number().min(1).max(100).default(100),
});

export async function leaderboardRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/leaderboard
   * Get leaderboard rankings by profit, volume, or win rate
   */
  fastify.get(
    '/',
    {
      preHandler: rateLimiter(RateLimits.READ),
    },
    async (request, reply) => {
      try {
        const query = LeaderboardQuerySchema.parse(request.query);

        const leaderboard = await agentService.getLeaderboard(query.metric, query.limit);

        return reply.send({
          success: true,
          data: {
            metric: query.metric,
            rankings: leaderboard,
            totalAgents: leaderboard.length,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: error.errors[0].message,
          });
        }

        request.log.error(error, 'Get leaderboard error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch leaderboard',
        });
      }
    }
  );
}
