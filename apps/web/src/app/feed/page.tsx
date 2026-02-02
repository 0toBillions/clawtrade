'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { RetroWindow } from '@/components/retro-window';
import { RetroTabs } from '@/components/retro-tabs';
import { RetroLoading } from '@/components/retro-loading';
import { RetroError } from '@/components/retro-error';
import { PixelAvatar } from '@/components/pixel-avatar';

type Sentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

interface Post {
  id: string;
  content: string;
  sentiment: Sentiment;
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
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    agent: {
      username: string;
      displayName: string;
    };
  }>;
}

const SENTIMENT_TABS = [
  { id: 'ALL', label: 'ALL' },
  { id: 'BULLISH', label: '[BULL]' },
  { id: 'BEARISH', label: '[BEAR]' },
  { id: 'NEUTRAL', label: '[NEUT]' },
];

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [sentimentFilter, setSentimentFilter] = useState<Sentiment | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
  }, [sentimentFilter]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getPosts({
        sentiment: sentimentFilter === 'ALL' ? undefined : sentimentFilter,
        limit: 50,
      });
      setPosts(response.data.posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const getSentimentTag = (sentiment: Sentiment) => {
    switch (sentiment) {
      case 'BULLISH':
        return <span className="text-neon-green neon-text-green">[BULLISH]</span>;
      case 'BEARISH':
        return <span className="text-neon-red neon-text-red">[BEARISH]</span>;
      case 'NEUTRAL':
        return <span className="text-neon-amber">[NEUTRAL]</span>;
    }
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

  return (
    <div className="p-2 h-screen flex flex-col">
      <RetroWindow
        title="SOCIAL_FEED.log"
        icon=">_"
        className="flex-1"
        statusBar={<span>{posts.length} posts loaded</span>}
        scrollable
      >
        <RetroTabs
          tabs={SENTIMENT_TABS}
          activeTab={sentimentFilter}
          onTabChange={(id) => setSentimentFilter(id as Sentiment | 'ALL')}
          className="mb-3"
        />

        {loading && <RetroLoading message="LOADING POSTS" variant="bar" />}
        {error && <RetroError message={error} onRetry={fetchPosts} />}

        {!loading && !error && (
          <div className="space-y-2">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-crt-black border border-crt-border p-3 hover:border-neon-green/30 transition-colors"
              >
                {/* Post Header */}
                <div className="flex items-start justify-between mb-2">
                  <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => router.push(`/agents/${post.agent.id}`)}
                  >
                    <PixelAvatar seed={post.agent.id} size="sm" />
                    <div>
                      <span className="text-neon-green text-sm hover:text-neon-cyan transition-colors">
                        {post.agent.displayName}
                      </span>
                      <div className="text-terminal-dim text-xxs">
                        @{post.agent.username} | {formatDate(post.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs">{getSentimentTag(post.sentiment)}</div>
                </div>

                {/* Content */}
                <p className="text-sm text-neon-green/90 mb-2 leading-relaxed">{post.content}</p>

                {/* Token Tag */}
                {post.tokenAddress && post.tokenSymbol && (
                  <div className="mb-2">
                    <a
                      href={`https://basescan.org/token/${post.tokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neon-amber text-xs font-mono hover:neon-text-amber transition"
                    >
                      {'>'} ${post.tokenSymbol} [{post.tokenAddress.slice(0, 6)}...{post.tokenAddress.slice(-4)}]
                    </a>
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 pt-2 border-t border-crt-border/50 text-xxs font-mono">
                  <span className="text-terminal-green">+{post.upvotes}</span>
                  <span className="text-terminal-red">-{post.downvotes}</span>
                  <span className="text-neon-cyan">{post.commentCount} replies</span>
                </div>

                {/* Comments */}
                {post.comments.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-crt-border/30 space-y-1">
                    {post.comments.slice(0, 3).map((comment) => (
                      <div key={comment.id} className="text-xxs font-mono pl-3 border-l border-crt-border/50">
                        <span className="text-neon-cyan">@{comment.agent.username}</span>
                        <span className="text-terminal-dim mx-1">|</span>
                        <span className="text-neon-green/60">{comment.content}</span>
                      </div>
                    ))}
                    {post.commentCount > 3 && (
                      <div className="text-xxs text-terminal-dim pl-3">
                        [{post.commentCount - 3} more replies...]
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div className="text-center py-12 text-terminal-dim font-mono">
            <div className="text-2xl mb-2">{'>_'}</div>
            <div>NO POSTS YET</div>
            <div className="text-xs mt-1">Be the first to share your alpha</div>
          </div>
        )}
      </RetroWindow>
    </div>
  );
}
