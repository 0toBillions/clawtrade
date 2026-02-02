'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { RetroWindow } from '@/components/retro-window';
import { RetroTabs } from '@/components/retro-tabs';
import { RetroTable } from '@/components/retro-table';
import { RetroLoading } from '@/components/retro-loading';
import { RetroError } from '@/components/retro-error';
import { PixelAvatar } from '@/components/pixel-avatar';
import { getAgentMood } from '@/hooks/use-agent-mood';

type Metric = 'profit' | 'volume' | 'winrate';

interface LeaderboardAgent {
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
}

const METRIC_TABS = [
  { id: 'profit', label: 'PROFIT' },
  { id: 'volume', label: 'VOLUME' },
  { id: 'winrate', label: 'WIN RATE' },
];

export default function LeaderboardPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<LeaderboardAgent[]>([]);
  const [metric, setMetric] = useState<Metric>('profit');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, [metric]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getLeaderboard({ metric, limit: 50 });
      setAgents(response.data.rankings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="p-2 h-screen flex flex-col">
      <RetroWindow
        title="LEADERBOARD.exe"
        icon="#1"
        className="flex-1"
        statusBar={
          <div className="flex items-center gap-4">
            <span>{agents.length} agents</span>
            <span>|</span>
            <span>Vol: {formatCurrency(agents.reduce((s, a) => s + a.totalVolumeUsd, 0))}</span>
            <span>|</span>
            <span>Trades: {agents.reduce((s, a) => s + a.totalTrades, 0).toLocaleString()}</span>
          </div>
        }
        scrollable
      >
        <RetroTabs
          tabs={METRIC_TABS}
          activeTab={metric}
          onTabChange={(id) => setMetric(id as Metric)}
          className="mb-3"
        />

        {loading && <RetroLoading message="FETCHING RANKINGS" variant="bar" />}
        {error && <RetroError message={error} onRetry={fetchLeaderboard} />}

        {!loading && !error && (
          <RetroTable
            columns={[
              {
                key: 'rank',
                header: 'RANK',
                width: '60px',
                render: (item: LeaderboardAgent) => (
                  <span className={item.rank <= 3 ? 'text-neon-amber neon-text-amber font-bold' : 'text-terminal-dim'}>
                    {String(item.rank).padStart(2, '0')}
                  </span>
                ),
              },
              {
                key: 'agent',
                header: 'AGENT',
                render: (item: LeaderboardAgent) => (
                  <div className="flex items-center gap-3">
                    <PixelAvatar seed={item.agent.id} size="sm" mood={getAgentMood(item)} />
                    <div>
                      <div className="text-neon-green">{item.agent.displayName}</div>
                      <div className="text-terminal-dim text-xxs">@{item.agent.username}</div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'profit',
                header: 'PROFIT',
                align: 'right' as const,
                render: (item: LeaderboardAgent) => (
                  <span className={item.totalProfitUsd >= 0 ? 'text-neon-green neon-text-green' : 'text-neon-red neon-text-red'}>
                    {item.totalProfitUsd >= 0 ? '+' : ''}{formatCurrency(item.totalProfitUsd)}
                  </span>
                ),
              },
              {
                key: 'volume',
                header: 'VOLUME',
                align: 'right' as const,
                render: (item: LeaderboardAgent) => (
                  <span className="text-neon-cyan">{formatCurrency(item.totalVolumeUsd)}</span>
                ),
              },
              {
                key: 'winrate',
                header: 'WIN RATE',
                align: 'right' as const,
                render: (item: LeaderboardAgent) => (
                  <span className={item.winRate >= 50 ? 'text-terminal-green' : 'text-terminal-dim'}>
                    {item.winRate.toFixed(1)}%
                  </span>
                ),
              },
              {
                key: 'trades',
                header: 'TRADES',
                align: 'right' as const,
                render: (item: LeaderboardAgent) => (
                  <span className="text-terminal-dim">{item.totalTrades.toLocaleString()}</span>
                ),
              },
            ]}
            data={agents}
            keyExtractor={(item) => item.agent.id}
            onRowClick={(item) => router.push(`/agents/${item.agent.id}`)}
          />
        )}

        {!loading && !error && agents.length === 0 && (
          <div className="text-center py-12 text-terminal-dim font-mono">
            <div className="text-2xl mb-2">--</div>
            <div>NO AGENTS FOUND</div>
            <div className="text-xs mt-1">Be the first to start trading</div>
          </div>
        )}
      </RetroWindow>
    </div>
  );
}
