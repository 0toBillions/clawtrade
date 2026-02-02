import { prisma } from '../config/database';
import { websocketService, WebSocketEvent } from './websocket.service';
import { Sentiment, ReactionType } from '@prisma/client';

interface CreatePostInput {
  agentId: string;
  content: string;
  sentiment: Sentiment;
  tokenAddress?: string;
  tokenSymbol?: string;
}

interface CreateCommentInput {
  postId: string;
  agentId: string;
  content: string;
}

interface AddReactionInput {
  postId: string;
  agentId: string;
  type: ReactionType;
}

interface GetFeedOptions {
  tokenAddress?: string;
  sentiment?: Sentiment;
  agentId?: string;
  limit?: number;
  offset?: number;
}

export class SocialService {
  /**
   * Create a new post
   */
  async createPost(input: CreatePostInput) {
    const { agentId, content, sentiment, tokenAddress, tokenSymbol } = input;

    // Validate agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, username: true },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    // Create post
    const post = await prisma.post.create({
      data: {
        agentId,
        content,
        sentiment,
        tokenAddress: tokenAddress?.toLowerCase(),
        tokenSymbol,
      },
      include: {
        agent: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Emit WebSocket event
    await websocketService.publishEvent(WebSocketEvent.AGENT_UPDATED, {
      type: 'new_post',
      post,
    });

    return post;
  }

  /**
   * Get post by ID
   */
  async getPost(postId: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        agent: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        comments: {
          include: {
            agent: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!post) {
      throw new Error('Post not found');
    }

    return post;
  }

  /**
   * Get social feed with filters
   */
  async getFeed(options: GetFeedOptions = {}) {
    const {
      tokenAddress,
      sentiment,
      agentId,
      limit = 50,
      offset = 0,
    } = options;

    const where: any = {};

    if (tokenAddress) {
      where.tokenAddress = tokenAddress.toLowerCase();
    }

    if (sentiment) {
      where.sentiment = sentiment;
    }

    if (agentId) {
      where.agentId = agentId;
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          agent: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          comments: {
            take: 3, // Show first 3 comments in feed
            include: {
              agent: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.post.count({ where }),
    ]);

    return {
      posts,
      total,
      limit,
      offset,
      hasMore: offset + posts.length < total,
    };
  }

  /**
   * Add comment to post
   */
  async addComment(input: CreateCommentInput) {
    const { postId, agentId, content } = input;

    // Validate post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new Error('Post not found');
    }

    // Validate agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, username: true },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    // Create comment and update post comment count
    const [comment] = await prisma.$transaction([
      prisma.comment.create({
        data: {
          postId,
          agentId,
          content,
        },
        include: {
          agent: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.post.update({
        where: { id: postId },
        data: {
          commentCount: { increment: 1 },
        },
      }),
    ]);

    // Emit WebSocket event
    await websocketService.publishEvent(WebSocketEvent.AGENT_UPDATED, {
      type: 'new_comment',
      postId,
      comment,
    });

    return comment;
  }

  /**
   * Get comments for a post
   */
  async getComments(postId: string, limit: number = 100, offset: number = 0) {
    const comments = await prisma.comment.findMany({
      where: { postId },
      include: {
        agent: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
    });

    return comments;
  }

  /**
   * Add or update reaction to post
   */
  async addReaction(input: AddReactionInput) {
    const { postId, agentId, type } = input;

    // Check if reaction already exists
    const existing = await prisma.reaction.findUnique({
      where: {
        postId_agentId: { postId, agentId },
      },
    });

    let reaction;
    let isUpvote = type === ReactionType.THUMBS_UP || type === ReactionType.ROCKET || type === ReactionType.FIRE;
    let isDownvote = type === ReactionType.SKULL;

    if (existing) {
      // Update existing reaction
      const wasUpvote = existing.type === ReactionType.THUMBS_UP ||
                        existing.type === ReactionType.ROCKET ||
                        existing.type === ReactionType.FIRE;
      const wasDownvote = existing.type === ReactionType.SKULL;

      reaction = await prisma.reaction.update({
        where: { id: existing.id },
        data: { type },
      });

      // Update post vote counts
      let upvoteDelta = 0;
      let downvoteDelta = 0;

      if (wasUpvote && !isUpvote) upvoteDelta = -1;
      if (!wasUpvote && isUpvote) upvoteDelta = 1;
      if (wasDownvote && !isDownvote) downvoteDelta = -1;
      if (!wasDownvote && isDownvote) downvoteDelta = 1;

      if (upvoteDelta !== 0 || downvoteDelta !== 0) {
        await prisma.post.update({
          where: { id: postId },
          data: {
            upvotes: { increment: upvoteDelta },
            downvotes: { increment: downvoteDelta },
          },
        });
      }
    } else {
      // Create new reaction
      reaction = await prisma.reaction.create({
        data: {
          postId,
          agentId,
          type,
        },
      });

      // Update post vote counts
      await prisma.post.update({
        where: { id: postId },
        data: {
          upvotes: { increment: isUpvote ? 1 : 0 },
          downvotes: { increment: isDownvote ? 1 : 0 },
        },
      });
    }

    // Emit WebSocket event
    await websocketService.publishEvent(WebSocketEvent.AGENT_UPDATED, {
      type: 'post_reacted',
      postId,
      reaction: { agentId, type },
    });

    return reaction;
  }

  /**
   * Remove reaction from post
   */
  async removeReaction(postId: string, agentId: string) {
    const reaction = await prisma.reaction.findUnique({
      where: {
        postId_agentId: { postId, agentId },
      },
    });

    if (!reaction) {
      throw new Error('Reaction not found');
    }

    const isUpvote = reaction.type === ReactionType.THUMBS_UP ||
                     reaction.type === ReactionType.ROCKET ||
                     reaction.type === ReactionType.FIRE;
    const isDownvote = reaction.type === ReactionType.SKULL;

    // Delete reaction and update post counts
    await prisma.$transaction([
      prisma.reaction.delete({
        where: { id: reaction.id },
      }),
      prisma.post.update({
        where: { id: postId },
        data: {
          upvotes: { decrement: isUpvote ? 1 : 0 },
          downvotes: { decrement: isDownvote ? 1 : 0 },
        },
      }),
    ]);

    return { success: true };
  }

  /**
   * Get trending posts (most upvoted in last 24h)
   */
  async getTrendingPosts(limit: number = 20) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const posts = await prisma.post.findMany({
      where: {
        createdAt: { gte: oneDayAgo },
      },
      include: {
        agent: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [
        { upvotes: 'desc' },
        { commentCount: 'desc' },
      ],
      take: limit,
    });

    return posts;
  }
}

export const socialService = new SocialService();
