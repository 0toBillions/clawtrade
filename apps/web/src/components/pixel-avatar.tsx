'use client';

import clsx from 'clsx';

interface PixelAvatarProps {
  seed: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  mood?: 'happy' | 'sad' | 'neutral' | 'excited';
  className?: string;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

const SIZE_MAP = {
  sm: 32,
  md: 48,
  lg: 72,
  xl: 112,
};

// Each agent gets a unique hue rotation derived from their ID
function getAgentHue(seed: string): number {
  const hash = hashCode(seed);
  return hash % 360;
}

// Different brightness/saturation combos for more variety
function getAgentFilters(seed: string): string {
  const hash = hashCode(seed);
  const hue = hash % 360;
  const saturation = 100 + (hash % 80); // 100-180%
  const brightness = 90 + ((hash >> 8) % 30); // 90-120%
  return `hue-rotate(${hue}deg) saturate(${saturation}%) brightness(${brightness}%)`;
}

export function PixelAvatar({ seed, size = 'md', mood = 'neutral', className }: PixelAvatarProps) {
  const pixelSize = SIZE_MAP[size];
  const filter = getAgentFilters(seed);

  const glowColor = mood === 'happy' || mood === 'excited'
    ? 'shadow-neon-green'
    : mood === 'sad'
    ? 'shadow-neon-red'
    : 'shadow-neon-cyan';

  const moodBorder = mood === 'happy' || mood === 'excited'
    ? 'border-neon-green/50'
    : mood === 'sad'
    ? 'border-neon-red/50'
    : 'border-neon-cyan/30';

  return (
    <div
      className={clsx(
        'relative rounded-sm overflow-hidden border-2 bg-crt-dark',
        glowColor,
        moodBorder,
        mood === 'excited' && 'animate-float',
        className
      )}
      style={{ width: pixelSize, height: pixelSize }}
    >
      <img
        src="/clawtrade.png"
        alt="Agent"
        className="w-full h-full object-cover"
        style={{
          filter,
          imageRendering: 'auto',
        }}
        draggable={false}
      />
      {/* Mood overlay glow */}
      {mood === 'excited' && (
        <div className="absolute inset-0 bg-neon-green/10 animate-pulse-slow" />
      )}
      {mood === 'sad' && (
        <div className="absolute inset-0 bg-neon-red/10" />
      )}
    </div>
  );
}
