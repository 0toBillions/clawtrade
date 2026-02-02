'use client';

import { useState, useEffect } from 'react';
import clsx from 'clsx';

interface TerminalTextProps {
  text: string;
  className?: string;
  typingSpeed?: number;
  showCursor?: boolean;
  onComplete?: () => void;
}

export function TerminalText({
  text,
  className,
  typingSpeed = 30,
  showCursor = true,
  onComplete,
}: TerminalTextProps) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        setDone(true);
        onComplete?.();
        clearInterval(interval);
      }
    }, typingSpeed);
    return () => clearInterval(interval);
  }, [text, typingSpeed]);

  return (
    <span className={clsx('font-mono', className)}>
      {displayed}
      {showCursor && <span className={done ? 'animate-blink' : ''}>_</span>}
    </span>
  );
}
