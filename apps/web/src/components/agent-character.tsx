'use client';

import clsx from 'clsx';
import { PixelAvatar } from './pixel-avatar';

interface AgentCharacterProps {
  agent: {
    id: string;
    username: string;
    displayName: string;
  };
  latestAction?: string;
  mood?: 'happy' | 'sad' | 'neutral' | 'excited';
  status?: 'trading' | 'posting' | 'idle';
  onClick?: () => void;
  compact?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  trading: 'TRADING',
  posting: 'POSTING',
  idle: 'IDLE',
};

const STATUS_COLORS: Record<string, string> = {
  trading: 'bg-neon-green/20 text-neon-green border-neon-green/40',
  posting: 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40',
  idle: 'bg-terminal-dim/20 text-terminal-dim border-terminal-dim/40',
};

const STATUS_DOT_COLORS: Record<string, string> = {
  trading: 'bg-neon-green',
  posting: 'bg-neon-cyan',
  idle: 'bg-terminal-dim',
};

export function AgentCharacter({
  agent,
  latestAction,
  mood = 'neutral',
  status = 'idle',
  onClick,
  compact = false,
}: AgentCharacterProps) {
  if (compact) {
    return (
      <div
        onClick={onClick}
        className={clsx(
          'flex items-center gap-2 group',
          onClick && 'cursor-pointer'
        )}
      >
        <PixelAvatar seed={agent.id} size="sm" mood={mood} />
        <div className="text-xxs text-terminal-dim truncate max-w-[60px] group-hover:text-neon-cyan transition-colors">
          @{agent.username}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={clsx(
        'flex flex-col items-center group relative',
        onClick && 'cursor-pointer'
      )}
    >
      {/* Speech Bubble */}
      {latestAction && (
        <div className="relative mb-2 max-w-[140px] w-full">
          <div className="bg-crt-dark/90 border border-neon-green/20 rounded-sm px-2 py-1.5 text-xxs font-mono text-neon-green/80 text-center truncate shadow-lg">
            {latestAction}
          </div>
          {/* Triangle pointer */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5">
            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-neon-green/20" />
          </div>
        </div>
      )}

      {/* Character Body */}
      <div className="relative">
        <PixelAvatar
          seed={agent.id}
          size="lg"
          mood={mood}
        />

        {/* Status badge */}
        <div className={clsx(
          'absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded-sm border text-xxs font-mono whitespace-nowrap',
          STATUS_COLORS[status]
        )}>
          <div className={clsx(
            'w-1.5 h-1.5 rounded-full',
            STATUS_DOT_COLORS[status],
            status === 'trading' && 'animate-pulse-slow'
          )} />
          {STATUS_LABELS[status]}
        </div>
      </div>

      {/* Name */}
      <div className="mt-3 text-center">
        <div className="text-xs font-bold text-neon-green group-hover:text-neon-cyan group-hover:neon-text-cyan transition-colors truncate max-w-[100px]">
          {agent.displayName}
        </div>
        <div className="text-xxs text-terminal-dim truncate max-w-[100px]">
          @{agent.username}
        </div>
      </div>
    </div>
  );
}
