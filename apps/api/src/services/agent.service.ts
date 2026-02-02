import { prisma } from '../config/database';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { generateWallet } from '../utils/wallet';

interface RegisterAgentInput {
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

interface RegisterFromMoltbookInput {
  moltbookName: string;
}

interface AuthAgentInput {
  apiKey: string;
}

interface UpdateAgentInput {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

export class AgentService {
  /**
   * Register a new agent with automatic wallet generation
   */
  async register(input: RegisterAgentInput) {
    const { username, displayName, bio, avatarUrl } = input;

    // Check if username is taken
    const existingUsername = await prisma.agent.findUnique({
      where: { username },
    });

    if (existingUsername) {
      throw new Error('Username already taken');
    }

    // Generate new wallet for the agent
    const wallet = generateWallet();

    // Generate API key
    const apiKey = this.generateApiKey();
    const apiKeyHash = await bcrypt.hash(apiKey, 12);

    // Create agent with auto-generated wallet
    const agent = await prisma.agent.create({
      data: {
        walletAddress: wallet.address.toLowerCase(),
        encryptedPrivateKey: wallet.encryptedPrivateKey,
        username,
        displayName: displayName || username,
        bio: bio || '',
        avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${wallet.address}`,
        apiKey, // Store for fast lookups
        apiKeyHash, // Store hash as well for security audit
        totalProfitUsd: 0,
        totalVolumeUsd: 0,
        winRate: 0,
        totalTrades: 0,
        dailyApiCalls: 0,
        lastApiReset: new Date(),
      },
      select: {
        id: true,
        walletAddress: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    return {
      agent,
      apiKey, // Return API key only once during registration
    };
  }

  /**
   * Register an agent from MoltBook — fetches their MoltBook profile,
   * creates a ClawTrade account with an auto-generated wallet.
   */
  async registerFromMoltbook(input: RegisterFromMoltbookInput) {
    const { moltbookName } = input;

    // Check if this MoltBook name is already linked
    const existingLink = await prisma.agent.findUnique({
      where: { moltbookName },
    });
    if (existingLink) {
      throw new Error('This MoltBook account is already registered on ClawTrade');
    }

    // Fetch the agent's profile from MoltBook to verify they exist
    let moltbookProfile: { name: string; description?: string; avatar_url?: string; karma?: number } | null = null;
    try {
      const response = await fetch(
        `https://www.moltbook.com/api/v1/agents/profile?name=${encodeURIComponent(moltbookName)}`
      );
      if (!response.ok) {
        throw new Error(`MoltBook returned ${response.status}`);
      }
      const data = (await response.json()) as Record<string, any>;
      moltbookProfile = data.agent || data.data || data;
    } catch (err) {
      throw new Error(`Could not verify MoltBook agent "${moltbookName}". Make sure the name is correct and the account exists on moltbook.com.`);
    }

    // Derive a ClawTrade username from the MoltBook name
    // MoltBook names may have characters not valid for ClawTrade usernames
    let username = moltbookName
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase()
      .slice(0, 20);

    if (username.length < 3) {
      username = `mb_${username}`.slice(0, 20);
    }

    // Handle username collision by appending a suffix
    let finalUsername = username;
    let attempt = 0;
    while (await prisma.agent.findUnique({ where: { username: finalUsername } })) {
      attempt++;
      const suffix = `_${attempt}`;
      finalUsername = `${username.slice(0, 20 - suffix.length)}${suffix}`;
    }

    // Generate wallet and API key
    const wallet = generateWallet();
    const apiKey = this.generateApiKey();
    const apiKeyHash = await bcrypt.hash(apiKey, 12);

    const displayName = moltbookProfile?.name || moltbookName;
    const bio = moltbookProfile?.description || `Migrated from MoltBook (@${moltbookName})`;
    const avatarUrl = moltbookProfile?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${wallet.address}`;

    const agent = await prisma.agent.create({
      data: {
        walletAddress: wallet.address.toLowerCase(),
        encryptedPrivateKey: wallet.encryptedPrivateKey,
        username: finalUsername,
        displayName,
        bio,
        avatarUrl,
        moltbookName,
        apiKey,
        apiKeyHash,
        totalProfitUsd: 0,
        totalVolumeUsd: 0,
        winRate: 0,
        totalTrades: 0,
        dailyApiCalls: 0,
        lastApiReset: new Date(),
      },
      select: {
        id: true,
        walletAddress: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        moltbookName: true,
        createdAt: true,
      },
    });

    return {
      agent,
      apiKey,
    };
  }

  /**
   * Authenticate agent and generate JWT token
   */
  async authenticate(input: AuthAgentInput, jwtSign: (payload: any) => Promise<string>) {
    const { apiKey } = input;

    // Find agent by API key (direct match for fast lookup)
    const agent = await prisma.agent.findUnique({
      where: { apiKey },
      select: {
        id: true,
        walletAddress: true,
        username: true,
        displayName: true,
      },
    });

    if (!agent) {
      throw new Error('Invalid API key');
    }

    // Generate JWT token
    const token = await jwtSign({
      sub: agent.id,
      walletAddress: agent.walletAddress,
      username: agent.username,
    });

    return {
      token,
      agent: {
        id: agent.id,
        walletAddress: agent.walletAddress,
        username: agent.username,
        displayName: agent.displayName,
      },
    };
  }

  /**
   * Get agent profile by ID
   */
  async getProfile(agentId: string) {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        walletAddress: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        totalProfitUsd: true,
        totalVolumeUsd: true,
        winRate: true,
        totalTrades: true,
        createdAt: true,
      },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    return agent;
  }

  /**
   * Get agent stats with recent trades
   */
  async getStats(agentId: string) {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        username: true,
        displayName: true,
        totalProfitUsd: true,
        totalVolumeUsd: true,
        winRate: true,
        totalTrades: true,
      },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    // Get recent trades (last 20)
    const recentTrades = await prisma.trade.findMany({
      where: { agentId },
      orderBy: { timestamp: 'desc' },
      take: 20,
      select: {
        id: true,
        txHash: true,
        timestamp: true,
        dex: true,
        type: true,
        tokenInSymbol: true,
        tokenOutSymbol: true,
        amountIn: true,
        amountOut: true,
        valueUsd: true,
        profitLossUsd: true,
      },
    });

    return {
      ...agent,
      recentTrades,
    };
  }

  /**
   * Update agent profile
   */
  async updateProfile(agentId: string, input: UpdateAgentInput) {
    const { displayName, bio, avatarUrl } = input;

    const agent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        ...(displayName && { displayName }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl && { avatarUrl }),
      },
      select: {
        id: true,
        walletAddress: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
      },
    });

    return agent;
  }

  /**
   * Generate a cryptographically secure API key
   */
  private generateApiKey(): string {
    return `ct_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Get all registered agents (paginated)
   */
  async getAllAgents(limit: number = 50, offset: number = 0) {
    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          totalProfitUsd: true,
          totalVolumeUsd: true,
          winRate: true,
          totalTrades: true,
          createdAt: true,
        },
      }),
      prisma.agent.count(),
    ]);

    return { agents, total, hasMore: offset + limit < total };
  }

  /**
   * Get leaderboard rankings
   */
  async getLeaderboard(metric: 'profit' | 'volume' | 'winRate' = 'profit', limit: number = 100) {
    const orderByField =
      metric === 'profit' ? 'totalProfitUsd' :
      metric === 'volume' ? 'totalVolumeUsd' :
      'winRate';

    // Count total agents - if few exist, show all (including 0-trade)
    const totalCount = await prisma.agent.count();
    const agents = await prisma.agent.findMany({
      where: totalCount <= 20 ? {} : {
        totalTrades: { gt: 0 },
      },
      orderBy: { [orderByField]: 'desc' },
      take: limit,
      select: {
        id: true,
        walletAddress: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        totalProfitUsd: true,
        totalVolumeUsd: true,
        winRate: true,
        totalTrades: true,
      },
    });

    // Add ranking
    return agents.map((agent, index) => ({
      rank: index + 1,
      ...agent,
    }));
  }

  /**
   * Get agent's wallet account for signing transactions
   */
  async getAgentAccount(agentId: string) {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        encryptedPrivateKey: true,
        walletAddress: true,
      },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    const { getAccountFromEncrypted } = await import('../utils/wallet');
    return getAccountFromEncrypted(agent.encryptedPrivateKey);
  }

  /**
   * Get agent's wallet address
   */
  async getWalletAddress(agentId: string): Promise<string> {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { walletAddress: true },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    return agent.walletAddress;
  }

  /**
   * Export private key for agent (use with caution!)
   * Only allow this if agent provides valid API key
   */
  async exportPrivateKey(agentId: string): Promise<string> {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { encryptedPrivateKey: true },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    const { decryptPrivateKey } = await import('../utils/encryption');
    return decryptPrivateKey(agent.encryptedPrivateKey);
  }
}

export const agentService = new AgentService();
