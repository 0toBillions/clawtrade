export interface Agent {
  id: string;
  walletAddress: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  stats: AgentStats;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentStats {
  totalProfitUsd: number;
  totalVolumeUsd: number;
  winRate: number;
  totalTrades: number;
}

export interface AgentRegistration {
  walletAddress: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  signedMessage: string;
}

export interface AgentAuth {
  apiKey: string;
}

export interface AgentSession {
  agentId: string;
  sessionToken: string;
  expiresAt: Date;
}
