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
  name?: string; // Alternative field name from API
  accountType: string;
  type?: string; // Alternative field name from API
  accountSubtype?: string;
  subtype?: string; // Alternative field name from API
  currentBalance?: number | string;
  current?: number; // Alternative field name from API
  availableBalance?: number;
  available?: number; // Alternative field name from API
  limit?: number;
  currency?: string;
  mask?: string;
  lastSynced?: string;
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

export function ConnectedAccountsList() {
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatuses, setSyncStatuses] = useState<Map<number, SyncStatus>>(new Map());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PlaidItem | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<AccountToDelete | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchConnectedAccounts();
  }, []);

  const fetchConnectedAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/plaid/accounts');
      
      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }

      const data = await response.json();
      console.log('[ConnectedAccountsList] Received data:', data);
      setItems(data.accounts || data.items || []);
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
      const response = await fetch(`/api/plaid/sync/${itemId}`, {
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

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    
    try {
      const response = await fetch('/api/plaid/sync-all', {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Sync failed');
      }

      const result = await response.json();
      
      toast({
        title: 'Sync Successful',
        description: result.message || 'All accounts have been updated with latest data from your banks',
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
      const response = await fetch(`/api/plaid/delete-account/${accountToDelete.account.accountId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to remove account');
      }

      toast({
        title: 'Account Removed',
        description: `${accountToDelete.account.accountName || 'Account'} has been removed successfully`,
      });

      // Refresh the accounts list
      await fetchConnectedAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove account',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    }
  };

  const getAccountTypeBadgeVariant = (type: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (type?.toLowerCase()) {
      case 'credit':
      case 'loan':
        return 'destructive';
      case 'investment':
        return 'secondary';
      default:
        return 'default';
    }
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
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
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
            Connect your bank accounts to automatically track your finances
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400 mb-4">
            Securely link your accounts to get real-time balances and transactions
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
      lastSync: item.lastSuccessfulUpdate
    }))
  );

  return (
    <>
      <Card className="card-gradient border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Connected Accounts</CardTitle>
              <CardDescription className="text-gray-400">
                {allAccounts.length} account{allAccounts.length !== 1 ? 's' : ''} from {items.length} institution{items.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Button
              onClick={handleSyncAll}
              disabled={isSyncingAll}
              className="bg-purple-600 text-white hover:bg-purple-700 border-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncingAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync All Accounts
                </>
              )}
            </Button>
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
                  const itemId = items.find(i => i.institutionName === account.institutionName)?.id;
                  const syncStatus = itemId ? syncStatuses.get(itemId) : undefined;
                  
                  return (
                    <TableRow key={account.id || index} className="border-gray-700 hover:bg-gray-800/30">
                      <TableCell className="text-white font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          {formatInstitutionName(account.institutionName)}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {/* Display first names only for privacy */}
                        {account.metadata?.ownerNames && account.metadata.ownerNames.length > 0
                          ? formatOwnerName(account.metadata.ownerNames.join(', '))
                          : '—'}
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
                            {formatCurrency(getAccountBalance(account))}
                          </p>
                          {account.availableBalance != null && account.availableBalance !== account.currentBalance && (
                            <p className="text-xs text-gray-400">
                              Available: {formatCurrency(Number(account.availableBalance))}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {getTimeSinceSync(account.lastSync || account.lastSynced)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {syncStatus && (
                            <div className="mr-2">
                              {getSyncStatusIcon(syncStatus)}
                            </div>
                          )}
                          {itemId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSync(itemId)}
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
                            className="text-gray-400 hover:text-white hover:bg-gray-700"
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
                {formatCurrency(allAccounts.reduce((sum, acc) => sum + getAccountBalance(acc), 0))}
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
              Are you sure you want to remove this account?
              <br /><br />
              <strong className="text-white">
                {accountToDelete?.account.accountName || 'Account'} 
                {accountToDelete?.account.mask && ` (...${accountToDelete.account.mask})`}
              </strong>
              <br />
              From: {accountToDelete?.institutionName}
              <br /><br />
              This will remove this account from your connected accounts and delete any imported data in your intake form. 
              You can reconnect this account at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 text-white hover:bg-red-700">
              Remove Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}