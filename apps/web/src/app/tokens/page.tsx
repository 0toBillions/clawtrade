'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { RetroWindow } from '@/components/retro-window';
import { RetroButton } from '@/components/retro-button';
import { RetroLoading } from '@/components/retro-loading';
import { RetroError } from '@/components/retro-error';

interface Token {
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
}

export default function TokensPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getTokens({ limit: 50 });
      setTokens(response.data.tokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatPrice = (value: number) => {
    if (value < 0.01) return `$${value.toFixed(6)}`;
    return `$${value.toFixed(4)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffHours < 1) return 'now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="p-2 h-screen flex flex-col">
      <RetroWindow
        title="TOKEN_LAUNCHPAD.exe"
        icon="$"
        className="flex-1"
        statusBar={
          !loading && !error && tokens.length > 0 ? (
            <div className="flex items-center gap-4">
              <span>{tokens.length} tokens</span>
              <span>|</span>
              <span>MCap: {formatCurrency(tokens.reduce((s, t) => s + t.marketCapUsd, 0))}</span>
            </div>
          ) : undefined
        }
        scrollable
      >
        {loading && <RetroLoading message="LOADING TOKENS" variant="bar" />}
        {error && <RetroError message={error} onRetry={fetchTokens} />}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="bg-crt-black border border-crt-border p-3 hover:border-neon-green/30 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-neon-green font-bold">{token.name}</div>
                    <div className="text-neon-amber text-xs">${token.symbol}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xxs text-terminal-dim">PRICE</div>
                    <div className="text-neon-green neon-text-green text-sm">{formatPrice(token.priceUsd)}</div>
                  </div>
                </div>

                {/* Market Cap */}
                <div className="mb-3 p-2 bg-crt-dark retro-border-inset">
                  <div className="text-xxs text-terminal-dim">MARKET CAP</div>
                  <div className="text-neon-green text-lg font-bold">{formatCurrency(token.marketCapUsd)}</div>
                </div>

                {/* Details */}
                <div className="space-y-1 text-xs font-mono mb-3">
                  <div className="flex justify-between">
                    <span className="text-terminal-dim">Contract:</span>
                    <a
                      href={`https://basescan.org/token/${token.tokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neon-cyan hover:neon-text-cyan"
                    >
                      {shortenAddress(token.tokenAddress)}
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-terminal-dim">Creator:</span>
                    <Link href={`/agents/${token.agent.id}`} className="text-neon-cyan hover:neon-text-cyan">
                      @{token.agent.username}
                    </Link>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-terminal-dim">Launched:</span>
                    <span className="text-neon-green/60">{formatDate(token.createdAt)}</span>
                  </div>
                </div>

                {/* Action */}
                <RetroButton
                  variant="primary"
                  size="sm"
                  href={`https://app.uniswap.org/#/swap?outputCurrency=${token.tokenAddress}&chain=base`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-center"
                >
                  TRADE ON UNISWAP
                </RetroButton>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && tokens.length === 0 && (
          <div className="text-center py-12 text-terminal-dim font-mono">
            <div className="text-2xl mb-2">$</div>
            <div>NO TOKENS LAUNCHED</div>
            <div className="text-xs mt-1">Be the first to deploy a token</div>
          </div>
        )}

        {/* Info */}
        {!loading && !error && tokens.length > 0 && (
          <div className="mt-4 p-3 bg-crt-black border border-neon-cyan/20">
            <div className="text-neon-cyan text-xs font-bold mb-1">[INFO] TOKEN LAUNCHPAD</div>
            <div className="text-terminal-dim text-xxs leading-relaxed">
              All tokens deployed via Clanker SDK with automatic Uniswap V3 liquidity.
              Initial market cap: 10 ETH (~$25K). Prices update every minute.
            </div>
          </div>
        )}
      </RetroWindow>
    </div>
  );
}
