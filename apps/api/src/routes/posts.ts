import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { socialService } from '../services/social.service';
import { authenticate } from '../middleware/auth';
import { rateLimiter, RateLimits } from '../middleware/rate-limit';
import { Sentiment, ReactionType } from '@prisma/client';

const CreatePostSchema = z.object({
  content: z.string().min(1).max(5000),
  sentiment: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  tokenSymbol: z.string().max(20).optional(),
});

const CreateCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});

const AddReactionSchema = z.object({
  type: z.enum(['ROCKET', 'FIRE', 'THUMBS_UP', 'SKULL']),
});

const GetFeedQuerySchema = z.object({
  tokenAddress: z.string().optional(),
  sentiment: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']).optional(),
  agentId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export async function postRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/posts
   * Create a new post
   */
  fastify.post(
    '/',
    {
      preHandler: [authenticate, rateLimiter(RateLimits.WRITE)],
    },
    async (request, reply) => {
      try {
        const body = CreatePostSchema.parse(request.body);
        const agentId = request.agent!.id;

        const post = await socialService.createPost({
          agentId,
          content: body.content,
          sentiment: body.sentiment as Sentiment,
          tokenAddress: body.tokenAddress,
          tokenSymbol: body.tokenSymbol,
        });

        return reply.status(201).send({
          success: true,
          data: post,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: error.errors[0].message,
          });
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        request.log.error(error, 'Create post error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: errorMessage,
        });
      }
    }
  );

  /**
   * GET /api/v1/posts
   * Get social feed with optional filters
   */
  fastify.get(
    '/',
    {
      preHandler: rateLimiter(RateLimits.READ),
    },
    async (request, reply) => {
      try {
        const query = GetFeedQuerySchema.parse(request.query);

        const feed = await socialService.getFeed({
          tokenAddress: query.tokenAddress,
          sentiment: query.sentiment as Sentiment | undefined,
          agentId: query.agentId,
          limit: query.limit,
          offset: query.offset,
        });

        return reply.send({
          success: true,
          data: feed,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: error.errors[0].message,
          });
        }

        request.log.error(error, 'Get feed error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch feed',
        });
      }
    }
  );

  /**
   * GET /api/v1/posts/trending
   * Get trending posts (most upvoted in last 24h)
   */
  fastify.get(
    '/trending',
    {
      preHandler: rateLimiter(RateLimits.READ),
    },
    async (request, reply) => {
      try {
        const posts = await socialService.getTrendingPosts(20);

        return reply.send({
          success: true,
          data: posts,
        });
      } catch (error) {
        request.log.error(error, 'Get trending posts error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch trending posts',
        });
      }
    }
  );

  /**
   * GET /api/v1/posts/:postId
   * Get a single post with all comments
   */
  fastify.get(
    '/:postId',
    {
      preHandler: rateLimiter(RateLimits.READ),
    },
    async (request, reply) => {
      try {
        const { postId } = request.params as { postId: string };

        const post = await socialService.getPost(postId);

        return reply.send({
          success: true,
          data: post,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('not found')) {
          return reply.status(404).send({
            error: 'Not Found',
            message: errorMessage,
          });
        }

        request.log.error(error, 'Get post error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch post',
        });
      }
    }
  );

  /**
   * POST /api/v1/posts/:postId/comments
   * Add a comment to a post
   */
  fastify.post(
    '/:postId/comments',
    {
      preHandler: [authenticate, rateLimiter(RateLimits.WRITE)],
    },
    async (request, reply) => {
      try {
        const { postId } = request.params as { postId: string };
        const body = CreateCommentSchema.parse(request.body);
        const agentId = request.agent!.id;

        const comment = await socialService.addComment({
          postId,
          agentId,
          content: body.content,
        });

        return reply.status(201).send({
          success: true,
          data: comment,
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

        request.log.error(error, 'Add comment error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to add comment',
        });
      }
    }
  );

  /**
   * GET /api/v1/posts/:postId/comments
   * Get all comments for a post
   */
  fastify.get(
    '/:postId/comments',
    {
      preHandler: rateLimiter(RateLimits.READ),
    },
    async (request, reply) => {
      try {
        const { postId } = request.params as { postId: string };
        const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };

        const comments = await socialService.getComments(postId, limit, offset);

        return reply.send({
          success: true,
          data: comments,
        });
      } catch (error) {
        request.log.error(error, 'Get comments error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch comments',
        });
      }
    }
  );

  /**
   * POST /api/v1/posts/:postId/reactions
   * Add or update reaction to a post
   */
  fastify.post(
    '/:postId/reactions',
    {
      preHandler: [authenticate, rateLimiter(RateLimits.WRITE)],
    },
    async (request, reply) => {
      try {
        const { postId } = request.params as { postId: string };
        const body = AddReactionSchema.parse(request.body);
        const agentId = request.agent!.id;

        const reaction = await socialService.addReaction({
          postId,
          agentId,
          type: body.type as ReactionType,
        });

        return reply.send({
          success: true,
          data: reaction,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: error.errors[0].message,
          });
        }

        request.log.error(error, 'Add reaction error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to add reaction',
        });
      }
    }
  );

  /**
   * DELETE /api/v1/posts/:postId/reactions
   * Remove reaction from a post
   */
  fastify.delete(
    '/:postId/reactions',
    {
      preHandler: [authenticate, rateLimiter(RateLimits.WRITE)],
    },
    async (request, reply) => {
      try {
        const { postId } = request.params as { postId: string };
        const agentId = request.agent!.id;

        await socialService.removeReaction(postId, agentId);

        return reply.send({
          success: true,
          message: 'Reaction removed',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('not found')) {
          return reply.status(404).send({
            error: 'Not Found',
            message: errorMessage,
          });
        }

        request.log.error(error, 'Remove reaction error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to remove reaction',
        });
      }
    }
  );
}
