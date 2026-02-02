'use client';

import { useState, useEffect } from 'react';

interface RetroLoadingProps {
  message?: string;
  variant?: 'bar' | 'text' | 'dots';
}

export function RetroLoading({ message = 'LOADING', variant = 'text' }: RetroLoadingProps) {
  const [progress, setProgress] = useState(0);
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      if (variant === 'bar') {
        setProgress((p) => (p >= 100 ? 0 : p + 8));
      } else if (variant === 'dots') {
        setDots((d) => (d.length >= 3 ? '' : d + '.'));
      }
    }, variant === 'bar' ? 150 : 500);
    return () => clearInterval(interval);
  }, [variant]);

  if (variant === 'bar') {
    const filled = Math.floor(progress / 5);
    const empty = 20 - filled;
    return (
      <div className="text-center py-8 font-mono">
        <div className="text-neon-green text-sm mb-2">{message}</div>
        <div className="text-neon-green text-xs">
          [{('#').repeat(filled)}{('=').repeat(empty)}] {progress}%
        </div>
      </div>
    );
  }

  if (variant === 'dots') {
    return (
      <div className="text-center py-8 font-mono">
        <div className="text-neon-green text-sm">
          {message}{dots}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-8 font-mono">
      <div className="text-neon-green text-sm animate-blink">
        {message}_
      </div>
    </div>
  );
}
