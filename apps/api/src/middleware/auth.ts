import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../config/database';

export interface AuthenticatedRequest extends FastifyRequest {
  agent?: {
    id: string;
    walletAddress: string;
    username: string;
  };
}

/**
 * Middleware to verify JWT token and attach agent to request
 */
export async function authenticate(
  request: AuthenticatedRequest,
  reply: FastifyReply
) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      });
    }

    const token = authHeader.substring(7);

    // Verify JWT token
    try {
      const decoded = await request.server.jwt.verify(token);

      // Fetch agent from database
      const agent = await prisma.agent.findUnique({
        where: { id: decoded.sub as string },
        select: {
          id: true,
          walletAddress: true,
          username: true,
        },
      });

      if (!agent) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Agent not found',
        });
      }

      // Attach agent to request
      request.agent = agent;
    } catch (err) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }
  } catch (error) {
    request.log.error(error, 'Authentication error');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Middleware to verify API key and attach agent to request
 * Used for agent-to-agent API calls
 */
export async function authenticateApiKey(
  request: AuthenticatedRequest,
  reply: FastifyReply
) {
  try {
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing X-API-Key header',
      });
    }

    // Find agent by API key hash
    const agent = await prisma.agent.findUnique({
      where: { apiKey },
      select: {
        id: true,
        walletAddress: true,
        username: true,
      },
    });

    if (!agent) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
    }

    // Attach agent to request
    request.agent = agent;
  } catch (error) {
    request.log.error(error, 'API key authentication error');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
}
