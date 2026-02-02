import { RetroWindow } from './retro-window';
import { RetroButton } from './retro-button';

interface RetroErrorProps {
  message: string;
  onRetry?: () => void;
}

export function RetroError({ message, onRetry }: RetroErrorProps) {
  return (
    <div className="flex justify-center py-8">
      <RetroWindow title="ERROR" icon="!" className="max-w-md w-full">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 bg-neon-red/20 border border-neon-red flex items-center justify-center text-neon-red font-bold shrink-0">
            X
          </div>
          <p className="text-neon-red text-sm font-mono">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          {onRetry && (
            <RetroButton onClick={onRetry} variant="primary" size="sm">
              RETRY
            </RetroButton>
          )}
          <RetroButton size="sm">OK</RetroButton>
        </div>
      </RetroWindow>
    </div>
  );
}
