import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link2, Edit, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlaidDataIndicatorProps {
  source: 'plaid' | 'manual' | 'mixed';
  lastSynced?: Date | string;
  className?: string;
  showTooltip?: boolean;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'badge' | 'icon' | 'text';
}

export function PlaidDataIndicator({
  source,
  lastSynced,
  className,
  showTooltip = true,
  size = 'default',
  variant = 'badge'
}: PlaidDataIndicatorProps) {
  const getIcon = () => {
    switch (source) {
      case 'plaid':
        return <Link2 className={cn(
          "inline-block",
          size === 'sm' ? "h-3 w-3" : size === 'lg' ? "h-5 w-5" : "h-4 w-4"
        )} />;
      case 'manual':
        return <Edit className={cn(
          "inline-block",
          size === 'sm' ? "h-3 w-3" : size === 'lg' ? "h-5 w-5" : "h-4 w-4"
        )} />;
      case 'mixed':
        return <RefreshCw className={cn(
          "inline-block",
          size === 'sm' ? "h-3 w-3" : size === 'lg' ? "h-5 w-5" : "h-4 w-4"
        )} />;
    }
  };

  const getLabel = () => {
    switch (source) {
      case 'plaid':
        return 'Connected';
      case 'manual':
        return 'Manual';
      case 'mixed':
        return 'Mixed';
    }
  };

  const getTooltipContent = () => {
    const lastSyncedStr = lastSynced ? 
      `Last updated: ${new Date(lastSynced).toLocaleDateString()}` : '';
    
    switch (source) {
      case 'plaid':
        return (
          <div className="space-y-1">
            <p className="font-semibold">Automatically Synced</p>
            <p className="text-xs">This data is automatically updated from your connected accounts</p>
            {lastSyncedStr && <p className="text-xs text-muted-foreground">{lastSyncedStr}</p>}
          </div>
        );
      case 'manual':
        return (
          <div className="space-y-1">
            <p className="font-semibold">Manually Entered</p>
            <p className="text-xs">This data was entered manually and may need updating</p>
          </div>
        );
      case 'mixed':
        return (
          <div className="space-y-1">
            <p className="font-semibold">Combined Data</p>
            <p className="text-xs">This includes both connected account data and manual entries</p>
            {lastSyncedStr && <p className="text-xs text-muted-foreground">{lastSyncedStr}</p>}
          </div>
        );
    }
  };

  const getBadgeVariant = (): "default" | "secondary" | "outline" | "destructive" => {
    switch (source) {
      case 'plaid':
        return 'default';
      case 'manual':
        return 'secondary';
      case 'mixed':
        return 'outline';
    }
  };

  const content = () => {
    switch (variant) {
      case 'icon':
        return getIcon();
      case 'text':
        return (
          <span className={cn(
            "inline-flex items-center gap-1",
            size === 'sm' ? "text-xs" : size === 'lg' ? "text-base" : "text-sm",
            className
          )}>
            {getIcon()}
            <span>{getLabel()}</span>
          </span>
        );
      case 'badge':
      default:
        return (
          <Badge 
            variant={getBadgeVariant()} 
            className={cn(
              "gap-1",
              size === 'sm' && "text-xs px-1.5 py-0",
              size === 'lg' && "text-base px-3 py-1",
              className
            )}
          >
            {getIcon()}
            <span>{getLabel()}</span>
          </Badge>
        );
    }
  };

  if (!showTooltip) {
    return content();
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {content()}
        </TooltipTrigger>
        <TooltipContent>
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Companion component for showing sync status
interface PlaidSyncStatusProps {
  status: 'synced' | 'syncing' | 'error' | 'stale';
  lastSynced?: Date | string;
  error?: string;
  className?: string;
  showLabel?: boolean;
}

export function PlaidSyncStatus({
  status,
  lastSynced,
  error,
  className,
  showLabel = true
}: PlaidSyncStatusProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'syncing':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'stale':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'synced':
        return 'Synced';
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Sync Error';
      case 'stale':
        return 'Needs Update';
    }
  };

  const getTooltipContent = () => {
    const lastSyncedStr = lastSynced ? 
      new Date(lastSynced).toLocaleString() : 'Never';
    
    switch (status) {
      case 'synced':
        return `Successfully synced on ${lastSyncedStr}`;
      case 'syncing':
        return 'Currently syncing with your connected accounts';
      case 'error':
        return error || 'An error occurred during sync';
      case 'stale':
        return `Last synced: ${lastSyncedStr}. Consider syncing for updated data.`;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "inline-flex items-center gap-1.5",
            className
          )}>
            {getStatusIcon()}
            {showLabel && (
              <span className={cn(
                "text-sm",
                status === 'synced' && "text-green-600",
                status === 'syncing' && "text-blue-600",
                status === 'error' && "text-red-600",
                status === 'stale' && "text-yellow-600"
              )}>
                {getStatusLabel()}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}