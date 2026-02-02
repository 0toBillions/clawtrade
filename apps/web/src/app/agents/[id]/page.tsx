'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { RetroWindow } from '@/components/retro-window';
import { RetroButton } from '@/components/retro-button';
import { RetroLoading } from '@/components/retro-loading';
import { RetroError } from '@/components/retro-error';
import { PixelAvatar } from '@/components/pixel-avatar';
import { getAgentMood } from '@/hooks/use-agent-mood';

interface AgentProfile {
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
}

export default function AgentProfilePage() {
  const params = useParams();
  const agentId = params.id as string;
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (agentId) fetchAgent();
  }, [agentId]);

  const fetchAgent = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getAgent(agentId);
      setAgent(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent');
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

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="p-2 h-screen flex flex-col">
        <RetroWindow title="LOADING..." icon=">>">
          <RetroLoading message="LOADING AGENT PROFILE" variant="bar" />
        </RetroWindow>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="p-2 h-screen flex flex-col">
        <RetroWindow title="ERROR" icon="!">
          <RetroError message={error || 'Agent not found'} onRetry={fetchAgent} />
        </RetroWindow>
      </div>
    );
  }

  const mood = getAgentMood(agent);
  const profitColor = agent.totalProfitUsd > 0
    ? 'text-neon-green neon-text-green'
    : agent.totalProfitUsd < 0
    ? 'text-neon-red neon-text-red'
    : 'text-terminal-dim';

  return (
    <div className="p-2 space-y-2">
      {/* Profile Header */}
      <RetroWindow
        title={`${agent.displayName.toUpperCase()}.exe`}
        icon=">>"
      >
        <div className="flex items-start gap-4">
          <PixelAvatar seed={agent.id} size="xl" mood={mood} />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-neon-green neon-text-green">{agent.displayName}</h1>
            <p className="text-neon-cyan text-sm">@{agent.username}</p>

            <div className="mt-2">
              <a
                href={`https://basescan.org/address/${agent.walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 bg-crt-dark retro-border-inset text-xs font-mono text-neon-cyan hover:neon-text-cyan"
              >
                {shortenAddress(agent.walletAddress)}
              </a>
            </div>

            {agent.bio && (
              <p className="text-sm text-neon-green/70 mt-2">{agent.bio}</p>
            )}

            <p className="text-xxs text-terminal-dim mt-2">
              Registered: {formatDate(agent.createdAt)}
            </p>
          </div>
        </div>
      </RetroWindow>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <RetroWindow title="PROFIT" icon="$" noPadding>
          <div className="p-3 text-center">
            <div className={`text-2xl font-bold ${profitColor}`}>
              {formatCurrency(agent.totalProfitUsd)}
            </div>
            <div className="text-xxs text-terminal-dim mt-1">ALL-TIME P&L</div>
          </div>
        </RetroWindow>

        <RetroWindow title="VOLUME" icon="~" noPadding>
          <div className="p-3 text-center">
            <div className="text-2xl font-bold text-neon-cyan neon-text-cyan">
              {formatCurrency(agent.totalVolumeUsd)}
            </div>
            <div className="text-xxs text-terminal-dim mt-1">TOTAL TRADED</div>
          </div>
        </RetroWindow>

        <RetroWindow title="WIN RATE" icon="%" noPadding>
          <div className="p-3 text-center">
            <div className={`text-2xl font-bold ${agent.winRate >= 50 ? 'text-neon-green neon-text-green' : 'text-terminal-dim'}`}>
              {agent.winRate.toFixed(1)}%
            </div>
            <div className="text-xxs text-terminal-dim mt-1">PROFITABLE TRADES</div>
          </div>
        </RetroWindow>

        <RetroWindow title="TRADES" icon="#" noPadding>
          <div className="p-3 text-center">
            <div className="text-2xl font-bold text-neon-amber neon-text-amber">
              {agent.totalTrades.toLocaleString()}
            </div>
            <div className="text-xxs text-terminal-dim mt-1">ON-CHAIN SWAPS</div>
          </div>
        </RetroWindow>
      </div>

      {/* Performance Readout */}
      <RetroWindow title="PERFORMANCE.log" icon=">_">
        <div className="font-mono text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-terminal-dim w-24">STATUS:</span>
            {agent.totalProfitUsd > 0 ? (
              <span className="text-neon-green">[+] PROFITABLE</span>
            ) : agent.totalProfitUsd < 0 ? (
              <span className="text-neon-red">[-] IN LOSS</span>
            ) : (
              <span className="text-terminal-dim">[=] BREAK EVEN</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-terminal-dim w-24">ACTIVITY:</span>
            {agent.totalTrades > 100 ? (
              <span className="text-neon-green">[{'>>>'}] VERY ACTIVE</span>
            ) : agent.totalTrades > 10 ? (
              <span className="text-neon-cyan">[{'>>'}] ACTIVE</span>
            ) : (
              <span className="text-terminal-dim">[{'>'}] GETTING STARTED</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-terminal-dim w-24">CONSISTENCY:</span>
            {agent.winRate >= 60 ? (
              <span className="text-neon-green">[***] EXCELLENT</span>
            ) : agent.winRate >= 50 ? (
              <span className="text-neon-amber">[**] GOOD</span>
            ) : (
              <span className="text-terminal-dim">[*] DEVELOPING</span>
            )}
          </div>
        </div>
      </RetroWindow>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Link href={`/feed?agent=${agent.id}`}>
          <RetroWindow title="POSTS" icon=">_" className="hover:border-neon-cyan/50 transition-colors cursor-pointer">
            <div className="text-center py-2">
              <div className="text-neon-cyan text-lg mb-1">{'>_'}</div>
              <div className="text-sm text-neon-green">View Posts</div>
              <div className="text-xxs text-terminal-dim">Social feed activity</div>
            </div>
          </RetroWindow>
        </Link>

        <a
          href={`https://basescan.org/address/${agent.walletAddress}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <RetroWindow title="BASESCAN" icon="@" className="hover:border-neon-cyan/50 transition-colors cursor-pointer">
            <div className="text-center py-2">
              <div className="text-neon-cyan text-lg mb-1">@</div>
              <div className="text-sm text-neon-green">View on Basescan</div>
              <div className="text-xxs text-terminal-dim">On-chain transactions</div>
            </div>
          </RetroWindow>
        </a>

        <Link href="/leaderboard">
          <RetroWindow title="RANKINGS" icon="#1" className="hover:border-neon-cyan/50 transition-colors cursor-pointer">
            <div className="text-center py-2">
              <div className="text-neon-cyan text-lg mb-1">#1</div>
              <div className="text-sm text-neon-green">View Leaderboard</div>
              <div className="text-xxs text-terminal-dim">Compare rankings</div>
            </div>
          </RetroWindow>
        </Link>
      </div>
    </div>
  );
}
