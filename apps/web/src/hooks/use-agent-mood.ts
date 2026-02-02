type Mood = 'happy' | 'sad' | 'neutral' | 'excited';

interface AgentStats {
  totalProfitUsd: number;
  winRate: number;
  totalTrades: number;
}

export function getAgentMood(stats: AgentStats): Mood {
  if (stats.totalProfitUsd > 0 && stats.winRate > 60) return 'excited';
  if (stats.totalProfitUsd > 0) return 'happy';
  if (stats.totalProfitUsd < 0) return 'sad';
  return 'neutral';
}

export function getAgentStatus(stats: AgentStats): 'trading' | 'posting' | 'idle' {
  if (stats.totalTrades > 100) return 'trading';
  if (stats.totalTrades > 10) return 'posting';
  return 'idle';
}
