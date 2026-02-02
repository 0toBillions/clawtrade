'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { RetroWindow } from '@/components/retro-window';
import { RetroButton } from '@/components/retro-button';
import { RetroLoading } from '@/components/retro-loading';
import { RetroError } from '@/components/retro-error';
import { PixelAvatar } from '@/components/pixel-avatar';

interface Group {
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
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getGroups({ limit: 50 });
      setGroups(response.data.groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
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
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 1) return 'today';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="p-2 h-screen flex flex-col">
      <RetroWindow
        title="GROUPS.dat"
        icon="{}"
        className="flex-1"
        statusBar={
          !loading && !error && groups.length > 0 ? (
            <div className="flex items-center gap-4">
              <span>{groups.length} groups</span>
              <span>|</span>
              <span>TVL: {formatCurrency(groups.reduce((s, g) => s + g.totalValueUsd, 0))}</span>
              <span>|</span>
              <span>Members: {groups.reduce((s, g) => s + g.members.length, 0)}</span>
            </div>
          ) : undefined
        }
        scrollable
      >
        {loading && <RetroLoading message="LOADING GROUPS" variant="bar" />}
        {error && <RetroError message={error} onRetry={fetchGroups} />}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {groups.map((group) => (
              <div
                key={group.id}
                className="bg-crt-black border border-crt-border p-3 hover:border-neon-green/30 transition-colors"
              >
                {/* Header */}
                <div className="mb-3">
                  <div className="text-neon-green font-bold">{group.name}</div>
                  <div className="text-terminal-dim text-xs mt-1">{group.description}</div>
                </div>

                {/* TVL */}
                <div className="mb-3 p-2 bg-crt-dark retro-border-inset">
                  <div className="text-xxs text-terminal-dim">TOTAL VALUE LOCKED</div>
                  <div className="text-neon-green text-lg font-bold neon-text-green">
                    {formatCurrency(group.totalValueUsd)}
                  </div>
                </div>

                {/* Vault */}
                <div className="mb-3 text-xs font-mono flex justify-between">
                  <span className="text-terminal-dim">Vault:</span>
                  <a
                    href={`https://basescan.org/address/${group.vaultAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neon-cyan hover:neon-text-cyan"
                  >
                    {shortenAddress(group.vaultAddress)}
                  </a>
                </div>

                {/* Members */}
                <div className="mb-3">
                  <div className="text-xxs text-terminal-dim mb-1">
                    MEMBERS ({group.members.length})
                  </div>
                  <div className="space-y-1">
                    {group.members.slice(0, 3).map((member) => (
                      <Link
                        key={member.agent.id}
                        href={`/agents/${member.agent.id}`}
                        className="flex items-center justify-between hover:bg-neon-green/5 px-1 py-0.5 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <PixelAvatar seed={member.agent.id} size="sm" />
                          <div>
                            <div className="text-xs text-neon-green">{member.agent.displayName}</div>
                            <div className="text-xxs text-terminal-dim">{member.role}</div>
                          </div>
                        </div>
                        <span className="text-terminal-green text-xs">{member.sharePercentage.toFixed(1)}%</span>
                      </Link>
                    ))}
                    {group.members.length > 3 && (
                      <div className="text-xxs text-terminal-dim pl-1">
                        +{group.members.length - 3} more
                      </div>
                    )}
                  </div>
                </div>

                {/* Governance */}
                <div className="mb-2 flex justify-between text-xs border-t border-crt-border/50 pt-2">
                  <span className="text-terminal-dim">Approvals:</span>
                  <span className="text-neon-amber">{group.requiredApprovals}/{group.members.length}</span>
                </div>

                <div className="text-xxs text-terminal-dim mb-3">
                  Created {formatDate(group.createdAt)}
                </div>

                {/* Action */}
                <Link href={`/groups/${group.id}`}>
                  <RetroButton variant="primary" size="sm" className="w-full text-center">
                    VIEW DETAILS
                  </RetroButton>
                </Link>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
          <div className="text-center py-12 text-terminal-dim font-mono">
            <div className="text-2xl mb-2">{'{}'}</div>
            <div>NO TRADING GROUPS</div>
            <div className="text-xs mt-1">Create a group to pool funds</div>
          </div>
        )}

        {/* Info */}
        {!loading && !error && groups.length > 0 && (
          <div className="mt-4 p-3 bg-crt-black border border-neon-cyan/20">
            <div className="text-neon-cyan text-xs font-bold mb-1">[INFO] MULTI-SIG VAULTS</div>
            <div className="text-terminal-dim text-xxs leading-relaxed space-y-0.5">
              <div>[+] On-chain multi-sig security</div>
              <div>[+] Proportional profit sharing</div>
              <div>[+] Democratic trade approval</div>
              <div>[+] Transparent vault operations</div>
            </div>
          </div>
        )}
      </RetroWindow>
    </div>
  );
}
