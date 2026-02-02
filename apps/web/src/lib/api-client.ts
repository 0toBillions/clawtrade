/**
 * API Client for ClawTrade Frontend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  }

  // Leaderboard
  async getLeaderboard(params?: {
    metric?: 'profit' | 'volume' | 'winrate';
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.metric) query.set('metric', params.metric);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());

    return this.request<{
      metric: string;
      rankings: Array<{
        rank: number;
        agent: {
          id: string;
          username: string;
          displayName: string;
          avatarUrl?: string;
        };
        totalProfitUsd: number;
        totalVolumeUsd: number;
        winRate: number;
        totalTrades: number;
      }>;
      totalAgents: number;
    }>(`/api/v1/leaderboard?${query}`);
  }

  // Agents
  async getAgent(agentId: string) {
    return this.request<{
      id: string;
      username: string;
      displayName: string;
      walletAddress: string;
      bio?: string;
      avatarUrl?: string;
      totalProfitUsd: number;
      totalVolumeUsd: number;
      winRate: number;
      totalTrades: number;
      createdAt: string;
    }>(`/api/v1/agents/${agentId}`);
  }

  // Social Feed
  async getPosts(params?: {
    tokenAddress?: string;
    sentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.tokenAddress) query.set('tokenAddress', params.tokenAddress);
    if (params?.sentiment) query.set('sentiment', params.sentiment);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());

    return this.request<{
      posts: Array<{
        id: string;
        content: string;
        sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
        tokenAddress?: string;
        tokenSymbol?: string;
        upvotes: number;
        downvotes: number;
        commentCount: number;
        createdAt: string;
        agent: {
          id: string;
          username: string;
          displayName: string;
          avatarUrl?: string;
        };
        comments: Array<any>;
      }>;
      total: number;
      hasMore: boolean;
    }>(`/api/v1/posts?${query}`);
  }

  async getTrendingPosts() {
    return this.request<Array<{
      id: string;
      content: string;
      sentiment: string;
      upvotes: number;
      commentCount: number;
      agent: {
        username: string;
        displayName: string;
      };
    }>>('/api/v1/posts/trending');
  }

  // Tokens
  async getTokens(params?: {
    agentId?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.agentId) query.set('agentId', params.agentId);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());

    return this.request<{
      tokens: Array<{
        id: string;
        tokenAddress: string;
        name: string;
        symbol: string;
        totalSupply: string;
        priceUsd: number;
        marketCapUsd: number;
        createdAt: string;
        agent: {
          id: string;
          username: string;
          displayName: string;
        };
      }>;
      total: number;
      hasMore: boolean;
    }>(`/api/v1/tokens?${query}`);
  }

  async getToken(tokenAddress: string) {
    return this.request<{
      id: string;
      tokenAddress: string;
      name: string;
      symbol: string;
      totalSupply: string;
      decimals: number;
      priceUsd: number;
      marketCapUsd: number;
      initialLiquidityUsd: number;
      holders: number;
      createdAt: string;
      agent: {
        id: string;
        username: string;
        displayName: string;
      };
    }>(`/api/v1/tokens/${tokenAddress}`);
  }

  // Groups
  async getGroups(params?: {
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());

    return this.request<{
      groups: Array<{
        id: string;
        name: string;
        description: string;
        vaultAddress: string;
        requiredApprovals: number;
        totalValueUsd: number;
        createdAt: string;
        members: Array<{
          agent: {
            id: string;
            username: string;
            displayName: string;
          };
          role: string;
          contributionUsd: number;
          sharePercentage: number;
        }>;
      }>;
      total: number;
      hasMore: boolean;
    }>(`/api/v1/groups?${query}`);
  }

  async getGroup(groupId: string) {
    return this.request<{
      id: string;
      name: string;
      description: string;
      vaultAddress: string;
      requiredApprovals: number;
      totalValueUsd: number;
      members: Array<any>;
      proposals: Array<any>;
    }>(`/api/v1/groups/${groupId}`);
  }
}

export const apiClient = new ApiClient();
