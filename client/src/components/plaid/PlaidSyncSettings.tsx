import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, RefreshCw, Calendar, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SyncSettings {
  autoSyncEnabled: boolean;
  syncFrequency: 'daily' | 'weekly' | 'monthly';
  syncTime: string;
  includeTransactions: boolean;
  includeInvestments: boolean;
  notifyOnSync: boolean;
  notifyOnErrors: boolean;
}

export function PlaidSyncSettings() {
  const [settings, setSettings] = useState<SyncSettings>({
    autoSyncEnabled: true,
    syncFrequency: 'monthly',
    syncTime: '02:00',
    includeTransactions: true,
    includeInvestments: true,
    notifyOnSync: false,
    notifyOnErrors: true,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastManualSync, setLastManualSync] = useState<Date | null>(null);
  const [syncCount, setSyncCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
    fetchSyncStatus();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/plaid/sync-settings');
      
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/plaid/sync-status');
      
      if (response.ok) {
        const data = await response.json();
        if (data.lastManualSync) {
          setLastManualSync(new Date(data.lastManualSync));
        }
        if (data.dailySyncCount !== undefined) {
          setSyncCount(data.dailySyncCount);
        }
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/plaid/sync-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast({
        title: 'Settings Saved',
        description: 'Your sync preferences have been updated',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleManualSync = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/plaid/sync-all', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      toast({
        title: 'Sync Complete',
        description: data.message || 'All accounts have been synchronized',
      });

      setLastManualSync(new Date());
      setSyncCount(prev => prev + 1);
    } catch (error) {
      console.error('Error during manual sync:', error);
      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync accounts',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const canManualSync = syncCount < 3;
  const remainingSyncs = Math.max(0, 3 - syncCount);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Manual Sync Card */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Sync</CardTitle>
          <CardDescription>
            Manually sync all your connected accounts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canManualSync && (
            <Alert>
              <AlertDescription>
                You've reached the daily manual sync limit. Automatic syncing will continue as scheduled.
                Manual syncs will reset at midnight.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Remaining manual syncs today: {remainingSyncs}/3
              </p>
              {lastManualSync && (
                <p className="text-xs text-gray-400">
                  Last manual sync: {lastManualSync.toLocaleString()}
                </p>
              )}
            </div>
            <Button
              onClick={handleManualSync}
              disabled={!canManualSync || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Automatic Sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Automatic Sync Settings</CardTitle>
          <CardDescription>
            Configure how often your accounts are automatically synchronized
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto Sync Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-sync">Enable Automatic Sync</Label>
              <p className="text-sm text-muted-foreground">
                Automatically sync your accounts on a schedule
              </p>
            </div>
            <Switch
              id="auto-sync"
              checked={settings.autoSyncEnabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, autoSyncEnabled: checked })
              }
            />
          </div>

          {/* Sync Frequency */}
          {settings.autoSyncEnabled && (
            <>
              <div className="space-y-3">
                <Label>Sync Frequency</Label>
                <RadioGroup
                  value={settings.syncFrequency}
                  onValueChange={(value) =>
                    setSettings({ ...settings, syncFrequency: value as 'daily' | 'weekly' | 'monthly' })
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="daily" id="daily" />
                    <Label htmlFor="daily">Daily</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="weekly" id="weekly" />
                    <Label htmlFor="weekly">Weekly</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="monthly" id="monthly" />
                    <Label htmlFor="monthly">Monthly (Recommended for cost savings)</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Sync Time */}
              <div className="space-y-2">
                <Label htmlFor="sync-time">Sync Time</Label>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="time"
                    id="sync-time"
                    value={settings.syncTime}
                    onChange={(e) =>
                      setSettings({ ...settings, syncTime: e.target.value })
                    }
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  Sync will occur daily at this time in your timezone
                </p>
              </div>
            </>
          )}

          {/* Data Selection */}
          <div className="space-y-4">
            <Label>Data to Sync</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="transactions">Transactions</Label>
                  <p className="text-sm text-muted-foreground">
                    Sync transaction history for spending analysis
                  </p>
                </div>
                <Switch
                  id="transactions"
                  checked={settings.includeTransactions}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, includeTransactions: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="investments">Investment Holdings</Label>
                  <p className="text-sm text-muted-foreground">
                    Sync investment positions and performance data
                  </p>
                </div>
                <Switch
                  id="investments"
                  checked={settings.includeInvestments}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, includeInvestments: checked })
                  }
                />
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="space-y-4">
            <Label>Notifications</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-sync">Sync Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when accounts are synced
                  </p>
                </div>
                <Switch
                  id="notify-sync"
                  checked={settings.notifyOnSync}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, notifyOnSync: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-errors">Error Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified if sync encounters errors
                  </p>
                </div>
                <Switch
                  id="notify-errors"
                  checked={settings.notifyOnErrors}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, notifyOnErrors: checked })
                  }
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={saveSettings}
            disabled={saving}
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Cost Optimization Tips */}
      <Alert>
        <Calendar className="h-4 w-4" />
        <AlertDescription>
          <strong>Cost Optimization Tip:</strong> Monthly syncing is recommended to minimize API costs 
          while still maintaining up-to-date financial data. You can always manually sync when needed 
          (up to 3 times per day).
        </AlertDescription>
      </Alert>
    </div>
  );
}