import clsx from 'clsx';

interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  render: (item: T, index: number) => React.ReactNode;
  width?: string;
}

interface RetroTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  className?: string;
  compact?: boolean;
}

export function RetroTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  className,
  compact = false,
}: RetroTableProps<T>) {
  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full font-mono text-sm">
        <thead>
          <tr className="border-b border-neon-green/30">
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  'text-neon-green/70 font-normal uppercase text-xs tracking-wider',
                  compact ? 'px-2 py-1' : 'px-3 py-2',
                  {
                    'text-left': col.align === 'left' || !col.align,
                    'text-right': col.align === 'right',
                    'text-center': col.align === 'center',
                  }
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr
              key={keyExtractor(item)}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              className={clsx(
                'border-b border-crt-border/50 transition-colors',
                onRowClick && 'cursor-pointer',
                'hover:bg-neon-green/5'
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={clsx(
                    compact ? 'px-2 py-1' : 'px-3 py-2',
                    {
                      'text-left': col.align === 'left' || !col.align,
                      'text-right': col.align === 'right',
                      'text-center': col.align === 'center',
                    }
                  )}
                >
                  {col.render(item, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
