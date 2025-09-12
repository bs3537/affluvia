import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PlaidLinkButton } from './PlaidLinkButton';
import { ConnectedAccountsListDirect } from './ConnectedAccountsListDirect';
import { Shield, Info, TrendingUp, DollarSign } from 'lucide-react';

export function PlaidAccountManagerDirect() {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    console.log('🏁 [PlaidAccountManagerDirect] Component mounted');
    return () => {
      console.log('🏁 [PlaidAccountManagerDirect] Component unmounted');
    };
  }, []);

  const handleAccountConnected = () => {
    console.log('💚 [PlaidAccountManagerDirect] Account connected! Refreshing accounts list...');
    // Refresh the connected accounts list
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Connected Accounts (Direct Sync)</h2>
        <p className="text-muted-foreground mt-2">
          Accounts sync directly to your financial profile for real-time calculations
        </p>
      </div>

      {/* Security Notice */}
      <Alert className="bg-gray-800/50 border-gray-700">
        <Shield className="h-4 w-4" />
        <AlertTitle className="text-white">Bank-Level Security</AlertTitle>
        <AlertDescription className="text-gray-300">
          We use Plaid to securely connect to your financial institutions. Your credentials are never stored on our servers, 
          and all data is encrypted using industry-standard security protocols.
        </AlertDescription>
      </Alert>

      {/* Enhanced Benefits Section */}
      <Card className="card-gradient border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Enhanced Direct Sync Benefits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex gap-3">
              <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-semibold text-white">Automatic Updates</h4>
                <p className="text-sm text-gray-400">
                  Dashboard and calculations update instantly with fresh data
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <DollarSign className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-semibold text-white">Direct Integration</h4>
                <p className="text-sm text-gray-400">
                  Accounts map directly to your intake form fields
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-semibold text-white">Real-Time Insights</h4>
                <p className="text-sm text-gray-400">
                  Financial metrics refresh automatically with each sync
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="space-y-4">
        {/* Add Account Button */}
        <Card className="card-gradient border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Add New Account</CardTitle>
            <CardDescription className="text-gray-400">
              Connect additional bank accounts, credit cards, or investment accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PlaidLinkButton 
              onSuccess={handleAccountConnected}
              size="lg"
              className="w-full sm:w-auto"
            />
          </CardContent>
        </Card>

        {/* Connected Accounts List */}
        <ConnectedAccountsListDirect key={refreshKey} />
      </div>
    </div>
  );
}