import React from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import { Button } from './button';

type Props = {
  timestamp?: string | number | Date | null;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  className?: string;
  label?: string; // allow overriding label text
};

export function LastCalculated({ timestamp, onRefresh, refreshing, className = '', label = 'Last calculated' }: Props) {
  let formatted = '—';
  if (timestamp) {
    const d = new Date(timestamp as any);
    if (!isNaN(d.getTime())) {
      formatted = d.toLocaleString();
    }
  }

  return (
    <div className={`flex items-center justify-between mb-3 ${className}`}>
      <span className="text-xs text-gray-500 flex items-center gap-1">
        <Clock className="w-3.5 h-3.5 text-gray-500" />
        {label}: {formatted}
      </span>
      {onRefresh && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onRefresh}
          disabled={!!refreshing}
          className="h-7 px-2 py-1 text-gray-400 hover:text-white"
          title="Refresh this widget"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      )}
    </div>
  );
}

