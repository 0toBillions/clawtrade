'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/', label: 'Desktop', icon: '[]' },
  { href: '/leaderboard', label: 'Leaderboard', icon: '#1' },
  { href: '/feed', label: 'Feed', icon: '>>' },
  { href: '/groups', label: 'Groups', icon: '{}' },
  { href: '/tokens', label: 'Tokens', icon: '$' },
];

export function Taskbar() {
  const pathname = usePathname();
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-crt-panel retro-border h-9 flex items-center px-1 gap-1">
      {/* Start Button */}
      <Link
        href="/"
        className="flex items-center gap-1.5 px-3 h-7 bg-crt-panel retro-border hover:bg-crt-border active:shadow-btn-pressed font-mono text-xs text-neon-green font-bold"
      >
        <span className="text-neon-cyan">[C]</span>
        <span>ClawTrade</span>
      </Link>

      {/* Separator */}
      <div className="w-px h-6 bg-crt-border mx-1" />

      {/* Nav Items */}
      <div className="flex items-center gap-0.5 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'px-3 h-7 flex items-center gap-1.5 font-mono text-xs transition-none',
                isActive
                  ? 'bg-crt-dark text-neon-green shadow-btn-pressed retro-border-inset'
                  : 'bg-crt-panel text-terminal-dim retro-border hover:text-neon-green hover:bg-crt-border'
              )}
            >
              <span className="text-neon-cyan/60">{item.icon}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* System Tray */}
      <div className="flex items-center gap-2 retro-border-inset px-2 h-7">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse-slow" />
          <span className="text-xxs font-mono text-terminal-dim hidden sm:inline">BASE</span>
        </div>
        <span className="text-xs font-mono text-terminal-dim">{time}</span>
      </div>
    </div>
  );
}
