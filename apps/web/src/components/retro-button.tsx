import clsx from 'clsx';

interface RetroButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  className?: string;
  href?: string;
  target?: string;
  rel?: string;
}

export function RetroButton({
  children,
  onClick,
  variant = 'default',
  size = 'md',
  active = false,
  className,
  href,
  target,
  rel,
}: RetroButtonProps) {
  const baseClasses = clsx(
    'font-mono inline-flex items-center justify-center select-none transition-none',
    'active:shadow-btn-pressed active:translate-x-px active:translate-y-px',
    {
      'px-2 py-0.5 text-xs': size === 'sm',
      'px-4 py-1.5 text-sm': size === 'md',
      'px-6 py-2 text-base': size === 'lg',
    },
    {
      'bg-crt-panel text-neon-green retro-border hover:bg-crt-border': variant === 'default' && !active,
      'bg-titlebar-active text-white retro-border hover:bg-blue-700': variant === 'primary' && !active,
      'bg-red-900 text-neon-red retro-border hover:bg-red-800': variant === 'danger' && !active,
      'bg-transparent text-terminal-dim hover:text-neon-green border border-transparent hover:border-crt-border': variant === 'ghost',
      'bg-titlebar-active text-white shadow-btn-pressed translate-x-px translate-y-px': active,
    },
    className
  );

  if (href) {
    return (
      <a href={href} target={target} rel={rel} className={baseClasses} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <button onClick={onClick} className={baseClasses}>
      {children}
    </button>
  );
}
