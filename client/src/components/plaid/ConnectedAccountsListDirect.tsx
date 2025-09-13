import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  CreditCard, 
  DollarSign, 
  Loader2, 
  RefreshCw, 
  Trash2, 
  AlertTriangle,
  Check,
  Clock,
  X
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { 
  formatInstitutionName, 
  formatOwnerName, 
  formatAccountType, 
  formatAccountSubtype,
  formatDisplayText,
  formatCurrency as formatCurrencyProfessional
} from '@/lib/format-utils';

interface PlaidAccount {
  id: number;
  accountId?: string;
  accountName: string;
  name?: string;
  accountType: string;
  type?: string;
  accountSubtype?: string;
  subtype?: string;
  currentBalance?: number | string;
  current?: number;
  availableBalance?: number;
  available?: number;
  limit?: number;
  currency?: string;
  mask?: string;
  lastSynced?: string;
  owner?: string;
  metadata?: {
    ownerNames?: string[];
    [key: string]: any;
  };
}

interface PlaidItem {
  id?: number;
  institutionName: string;
  institutionId?: string;
  itemId?: string;
  status?: string;
  lastSuccessfulUpdate?: string;
  consentExpirationTime?: string;
  accounts: PlaidAccount[];
}

interface SyncStatus {
  itemId: number;
  status: 'syncing' | 'success' | 'error';
  message?: string;
}

interface AccountToDelete {
  account: PlaidAccount;
  institutionName: string;
}

export function ConnectedAccountsListDirect() {
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatuses, setSyncStatuses] = useState<Map<number, SyncStatus>>(new Map());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PlaidItem | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<AccountToDelete | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchConnectedAccounts();
  }, []);

  const fetchConnectedAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/plaid/accounts-v2');
      
      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }

      const data = await response.json();
      console.log('[ConnectedAccountsListDirect] Received data:', data);
      setItems(data.accounts || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load connected accounts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (itemId: number) => {
    setSyncStatuses(prev => new Map(prev).set(itemId, { itemId, status: 'syncing' }));

    try {
      const response = await fetch(`/api/plaid/sync-v2/${itemId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Sync failed');
      }

      const result = await response.json();
      
      setSyncStatuses(prev => new Map(prev).set(itemId, { 
        itemId, 
        status: 'success',
        message: result.message 
      }));

      toast({
        title: 'Sync Successful',
        description: result.message || 'Account data has been updated',
      });

      // Refresh the accounts list
      await fetchConnectedAccounts();

      // Clear success status after 3 seconds
      setTimeout(() => {
        setSyncStatuses(prev => {
          const newMap = new Map(prev);
          newMap.delete(itemId);
          return newMap;
        });
      }, 3000);
    } catch (error) {
      setSyncStatuses(prev => new Map(prev).set(itemId, { 
        itemId, 
        status: 'error',
        message: error instanceof Error ? error.message : 'Sync failed' 
      }));

      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync account',
        variant: 'destructive',
      });

      // Clear error status after 5 seconds
      setTimeout(() => {
        setSyncStatuses(prev => {
          const newMap = new Map(prev);
          newMap.delete(itemId);
          return newMap;
        });
      }, 5000);
    }
  };

  const handleRefreshFromPlaid = async () => {
    setIsRefreshing(true);
    
    try {
      // First, refresh data from Plaid API
      const refreshResponse = await fetch('/api/plaid/refresh-all', {
        method: 'POST',
      });

      if (!refreshResponse.ok) {
        const error = await refreshResponse.json();
        throw new Error(error.message || 'Refresh failed');
      }

      const refreshResult = await refreshResponse.json();
      
      // Then sync the refreshed data to financial profile
      const syncResponse = await fetch('/api/plaid/sync-all-v2', {
        method: 'POST',
      });

      if (!syncResponse.ok) {
        const error = await syncResponse.json();
        throw new Error(error.message || 'Sync failed');
      }

      toast({
        title: 'Refresh Successful',
        description: `Updated ${refreshResult.accountsUpdated || 0} accounts with latest data from your bank`,
      });

      // Refresh the accounts list to display the fresh data
      await fetchConnectedAccounts();
    } catch (error) {
      toast({
        title: 'Refresh Failed',
        description: error instanceof Error ? error.message : 'Failed to refresh accounts',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    
    try {
      const response = await fetch('/api/plaid/sync-all-v2', {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Sync failed');
      }

      const result = await response.json();
      
      toast({
        title: 'Sync Successful',
        description: result.message || 'All accounts have been synced to your financial profile',
      });

      // Refresh the accounts list to display the fresh data
      await fetchConnectedAccounts();
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync accounts',
        variant: 'destructive',
      });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleDeleteClick = (account: PlaidAccount, institutionName: string) => {
    setAccountToDelete({ account, institutionName });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!accountToDelete) return;

    try {
      // Delete the account from plaid_accounts table
      const response = await fetch(`/api/plaid/delete-account/${accountToDelete.account.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete account');
      }

      const result = await response.json();
      
      // If this was the last account for an institution, optionally unlink from Plaid
      if (result.shouldUnlinkItem && result.itemId) {
        const unlinkResponse = await fetch(`/api/plaid/unlink-item/${result.itemId}`, {
          method: 'DELETE',
        });
        
        if (unlinkResponse.ok) {
          toast({
            title: 'Account Unlinked',
            description: 'The institution has been completely unlinked from Plaid',
          });
        }
      } else {
        toast({
          title: 'Account Removed',
          description: `${accountToDelete.account.accountName || 'Account'} has been removed from your profile`,
        });
      }

      // Refresh the accounts list
      await fetchConnectedAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove account',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    }
  };

  const getAccountTypeBadgeVariant = (type: string): "default" | "secondary" | "outline" | "destructive" => {
    if (type === 'liability') {
      return 'destructive';
    }
    return 'default';
  };

  const getSyncStatusIcon = (status: SyncStatus) => {
    switch (status.status) {
      case 'syncing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <Check className="h-4 w-4 text-green-400" />;
      case 'error':
        return <X className="h-4 w-4 text-red-400" />;
      default:
        return null;
    }
  };

  const getTimeSinceSync = (lastSynced?: string) => {
    if (!lastSynced) return 'Never';
    
    const now = new Date();
    const syncDate = new Date(lastSynced);
    const diffMs = now.getTime() - syncDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  // Helper function to get account value safely
  const getAccountName = (account: PlaidAccount) => account.accountName || account.name || 'Unknown Account';
  const getAccountType = (account: PlaidAccount) => account.accountType || account.type || 'Unknown';
  const getAccountSubtype = (account: PlaidAccount) => account.accountSubtype || account.subtype || getAccountType(account);
  const getAccountBalance = (account: PlaidAccount) => {
    if (account.currentBalance !== undefined) return Number(account.currentBalance);
    if (account.current !== undefined) return Number(account.current);
    return 0;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="card-gradient border-gray-700">
            <CardHeader>
              <Skeleton className="h-6 w-48 bg-gray-700" />
              <Skeleton className="h-4 w-32 mt-2 bg-gray-700" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-12 w-full bg-gray-700" />
                <Skeleton className="h-12 w-full bg-gray-700" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="card-gradient border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">No Connected Accounts</CardTitle>
          <CardDescription className="text-gray-400">
            Connect your bank accounts to automatically sync with your financial profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400 mb-4">
            Securely link your accounts to keep your financial data up-to-date
          </p>
        </CardContent>
      </Card>
    );
  }

  // Flatten all accounts from all institutions for table display
  const allAccounts = items.flatMap(item => 
    item.accounts.map(account => ({
      ...account,
      institutionName: item.institutionName,
      institutionId: item.institutionId || item.itemId,
      itemId: item.id,
      lastSync: item.lastSuccessfulUpdate || account.lastSynced
    }))
  );

  return (
    <>
      <Card className="card-gradient border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Connected Accounts (Direct Sync)</CardTitle>
              <CardDescription className="text-gray-400">
                {allAccounts.length} account{allAccounts.length !== 1 ? 's' : ''} from {items.length} institution{items.length !== 1 ? 's' : ''}
                <span className="text-purple-400 ml-2">[Auto-syncs to financial profile]</span>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleRefreshFromPlaid}
                disabled={isRefreshing}
                className="bg-blue-600 text-white hover:bg-blue-700 border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh from Bank
                  </>
                )}
              </Button>
              <Button
                onClick={handleSyncAll}
                disabled={isSyncingAll}
                className="bg-purple-600 text-white hover:bg-purple-700 border-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSyncingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Syncing to Profile...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync All to Profile
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-gray-700 overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-800/50">
                <TableRow className="border-gray-700 hover:bg-gray-800/70">
                  <TableHead className="text-gray-300 font-semibold">Institution</TableHead>
                  <TableHead className="text-gray-300 font-semibold">Owner</TableHead>
                  <TableHead className="text-gray-300 font-semibold">Account Name</TableHead>
                  <TableHead className="text-gray-300 font-semibold">Account Type</TableHead>
                  <TableHead className="text-gray-300 font-semibold">Account Subtype</TableHead>
                  <TableHead className="text-gray-300 font-semibold text-right">Account Balance</TableHead>
                  <TableHead className="text-gray-300 font-semibold">Last Synced</TableHead>
                  <TableHead className="text-gray-300 font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allAccounts.map((account, index) => {
                  const syncStatus = account.itemId ? syncStatuses.get(account.itemId) : undefined;
                  
                  return (
                    <TableRow key={account.id || index} className="border-gray-700 hover:bg-gray-800/30">
                      <TableCell className="text-white font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          {formatInstitutionName(account.institutionName)}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {account.metadata?.ownerNames && account.metadata.ownerNames.length > 0
                          ? formatOwnerName(account.metadata.ownerNames.join(', '))
                          : account.owner || '—'}
                      </TableCell>
                      <TableCell className="text-white">
                        <div className="flex items-center gap-2">
                          {formatDisplayText(getAccountName(account))}
                          {account.mask && (
                            <span className="text-xs text-gray-500">
                              (...{account.mask})
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getAccountTypeBadgeVariant(getAccountType(account))}>
                          {formatAccountType(getAccountType(account))}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {formatAccountSubtype(getAccountSubtype(account))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <p className="font-semibold text-white">
                            {formatCurrency(Math.abs(getAccountBalance(account)))}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {getTimeSinceSync(account.lastSync)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {syncStatus && (
                            <div className="mr-2">
                              {getSyncStatusIcon(syncStatus)}
                            </div>
                          )}
                          {account.itemId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSync(account.itemId!)}
                              disabled={syncStatus?.status === 'syncing'}
                              className="text-gray-400 hover:text-white hover:bg-gray-700"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(account, account.institutionName)}
                            className="text-gray-400 hover:text-red-400 hover:bg-gray-700"
                            title="Remove account"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm">Total Balance</p>
              <p className="text-2xl font-bold text-white mt-1">
                {formatCurrency(allAccounts.reduce((sum, acc) => sum + Math.abs(getAccountBalance(acc)), 0))}
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm">Connected Institutions</p>
              <p className="text-2xl font-bold text-white mt-1">
                {items.length}
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm">Total Accounts</p>
              <p className="text-2xl font-bold text-white mt-1">
                {allAccounts.length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gray-800 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remove Account</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to remove <span className="text-white font-medium">{accountToDelete?.account.accountName || 'this account'}</span> from {accountToDelete?.institutionName}?
              <br /><br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Remove the account from your connected accounts</li>
                <li>Delete it from your financial profile</li>
                <li>Remove it from intake form data</li>
              </ul>
              <br />
              Note: The account will remain connected in Plaid. To fully disconnect, use the main Connections page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Remove Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}