import clsx from 'clsx';

interface Tab {
  id: string;
  label: string;
}

interface RetroTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function RetroTabs({ tabs, activeTab, onTabChange, className }: RetroTabsProps) {
  return (
    <div className={clsx('flex gap-0', className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={clsx(
              'px-4 py-1.5 text-xs font-mono relative transition-none',
              isActive
                ? 'bg-crt-dark text-neon-green border-t-2 border-l-2 border-r-2 border-t-[#444] border-l-[#444] border-r-[#111] -mb-px z-10'
                : 'bg-crt-panel text-terminal-dim border border-crt-border hover:text-neon-green'
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
