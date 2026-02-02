'use client';

import { useState } from 'react';
import clsx from 'clsx';

interface RetroWindowProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
  icon?: string;
  statusBar?: React.ReactNode;
  scrollable?: boolean;
  defaultMinimized?: boolean;
  noPadding?: boolean;
}

export function RetroWindow({
  title,
  children,
  className,
  onClose,
  icon,
  statusBar,
  scrollable = false,
  defaultMinimized = false,
  noPadding = false,
}: RetroWindowProps) {
  const [minimized, setMinimized] = useState(defaultMinimized);

  return (
    <div
      className={clsx(
        'flex flex-col bg-crt-panel retro-border',
        className
      )}
    >
      {/* Title Bar */}
      <div className="titlebar-gradient flex items-center justify-between px-2 py-1 select-none shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-xs">{icon}</span>}
          <span className="text-white text-xs font-mono truncate font-bold tracking-wide">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setMinimized(!minimized)}
            className="w-4 h-4 bg-win-gray retro-border flex items-center justify-center hover:bg-win-light active:shadow-btn-pressed text-[8px] leading-none text-black"
          >
            _
          </button>
          <button
            className="w-4 h-4 bg-win-gray retro-border flex items-center justify-center hover:bg-win-light active:shadow-btn-pressed text-[8px] leading-none text-black"
          >
            ▢
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="w-4 h-4 bg-win-gray retro-border flex items-center justify-center hover:bg-win-light active:shadow-btn-pressed text-[8px] leading-none text-black"
            >
              X
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!minimized && (
        <>
          <div
            className={clsx(
              'flex-1 bg-crt-dark retro-border-inset',
              scrollable && 'overflow-y-auto',
              !noPadding && 'p-3',
              !scrollable && 'overflow-hidden'
            )}
          >
            {children}
          </div>

          {/* Status Bar */}
          {statusBar && (
            <div className="bg-crt-panel border-t border-crt-border px-2 py-0.5 text-terminal-dim text-xs font-mono shrink-0">
              {statusBar}
            </div>
          )}
        </>
      )}
    </div>
  );
}
