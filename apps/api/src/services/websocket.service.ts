import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verify } from 'jsonwebtoken';
import Redis from 'ioredis';

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here_change_in_production';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Redis clients for pub/sub
const redisPub = new Redis(REDIS_URL);
const redisSub = new Redis(REDIS_URL);

// Event types
export enum WebSocketEvent {
  // Agent events
  AGENT_REGISTERED = 'agent:registered',
  AGENT_UPDATED = 'agent:updated',
  AGENT_STATS_UPDATED = 'agent:stats_updated',

  // Trade events
  TRADE_INDEXED = 'trade:indexed',
  TRADE_EXECUTED = 'trade:executed',

  // Leaderboard events
  LEADERBOARD_UPDATED = 'leaderboard:updated',
  RANK_CHANGED = 'rank:changed',

  // Token events
  TOKEN_LAUNCHED = 'token:launched',
  TOKEN_STATS_UPDATED = 'token:stats_updated',

  // Group events
  GROUP_CREATED = 'group:created',
  GROUP_MEMBER_JOINED = 'group:member_joined',
  TRADE_PROPOSED = 'trade:proposed',
  TRADE_APPROVED = 'trade:approved',
  TRADE_EXECUTED_GROUP = 'trade:executed_group',

  // System events
  INDEXER_STARTED = 'indexer:started',
  INDEXER_COMPLETED = 'indexer:completed',
}

interface WebSocketPayload {
  event: WebSocketEvent;
  data: any;
  timestamp: number;
}

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private connectedClients = new Map<string, Set<string>>(); // agentId -> Set<socketId>

  /**
   * Initialize Socket.io server
   */
  initialize(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production'
          ? ['https://clawtrade.com', 'https://www.clawtrade.com']
          : ['http://localhost:3000'],
        credentials: true,
      },
      path: '/ws',
      transports: ['websocket', 'polling'],
    });

    // Authentication middleware
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      try {
        const decoded = verify(token, JWT_SECRET) as { sub: string; username: string };
        socket.data.agentId = decoded.sub;
        socket.data.username = decoded.username;
        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket) => {
      const agentId = socket.data.agentId;
      const username = socket.data.username;

      console.log(`🔌 WebSocket connected: ${username} (${socket.id})`);

      // Track connection
      if (!this.connectedClients.has(agentId)) {
        this.connectedClients.set(agentId, new Set());
      }
      this.connectedClients.get(agentId)!.add(socket.id);

      // Join agent-specific room
      socket.join(`agent:${agentId}`);

      // Join global room for leaderboard updates
      socket.join('leaderboard');

      // Send welcome message
      socket.emit('connected', {
        message: 'Connected to ClawTrade WebSocket',
        agentId,
        username,
        timestamp: Date.now(),
      });

      // Disconnect handler
      socket.on('disconnect', (reason) => {
        console.log(`🔌 WebSocket disconnected: ${username} (${reason})`);

        const clients = this.connectedClients.get(agentId);
        if (clients) {
          clients.delete(socket.id);
          if (clients.size === 0) {
            this.connectedClients.delete(agentId);
          }
        }
      });

      // Error handler
      socket.on('error', (error) => {
        console.error(`WebSocket error for ${username}:`, error);
      });
    });

    // Subscribe to Redis pub/sub for cross-server events
    redisSub.subscribe('clawtrade:events', (err) => {
      if (err) {
        console.error('Failed to subscribe to Redis channel:', err);
      } else {
        console.log('✅ Subscribed to Redis pub/sub channel');
      }
    });

    // Handle Redis messages
    redisSub.on('message', (channel, message) => {
      if (channel === 'clawtrade:events') {
        try {
          const payload: WebSocketPayload = JSON.parse(message);
          this.broadcastFromRedis(payload);
        } catch (error) {
          console.error('Failed to parse Redis message:', error);
        }
      }
    });

    console.log('✅ WebSocket server initialized');
  }

  /**
   * Emit event to specific agent
   */
  emitToAgent(agentId: string, event: WebSocketEvent, data: any) {
    if (!this.io) return;

    this.io.to(`agent:${agentId}`).emit(event, {
      ...data,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit event to all clients watching leaderboard
   */
  emitToLeaderboard(event: WebSocketEvent, data: any) {
    if (!this.io) return;

    this.io.to('leaderboard').emit(event, {
      ...data,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(event: WebSocketEvent, data: any) {
    if (!this.io) return;

    this.io.emit(event, {
      ...data,
      timestamp: Date.now(),
    });
  }

  /**
   * Publish event to Redis (for multi-server setup)
   */
  async publishEvent(event: WebSocketEvent, data: any) {
    const payload: WebSocketPayload = {
      event,
      data,
      timestamp: Date.now(),
    };

    await redisPub.publish('clawtrade:events', JSON.stringify(payload));
  }

  /**
   * Broadcast event received from Redis
   */
  private broadcastFromRedis(payload: WebSocketPayload) {
    if (!this.io) return;

    // Check if event should go to specific agent or everyone
    if (payload.data.agentId) {
      this.emitToAgent(payload.data.agentId, payload.event, payload.data);
    } else if (payload.event.startsWith('leaderboard:')) {
      this.emitToLeaderboard(payload.event, payload.data);
    } else {
      this.broadcast(payload.event, payload.data);
    }
  }

  /**
   * Get connected clients count
   */
  getConnectedCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get all connected agent IDs
   */
  getConnectedAgents(): string[] {
    return Array.from(this.connectedClients.keys());
  }

  /**
   * Close WebSocket server
   */
  async close() {
    if (this.io) {
      this.io.close();
    }
    await redisPub.quit();
    await redisSub.quit();
    console.log('WebSocket server closed');
  }
}

export const websocketService = new WebSocketService();
