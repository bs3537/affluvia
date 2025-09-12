import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PlaidLinkButton } from './PlaidLinkButton';
import { ConnectedAccountsList } from './ConnectedAccountsList';
import { Shield, Info, TrendingUp, DollarSign } from 'lucide-react';

export function PlaidAccountManager() {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    console.log('🏁 [PlaidAccountManager] Component mounted');
    return () => {
      console.log('🏁 [PlaidAccountManager] Component unmounted');
    };
  }, []);

  const handleAccountConnected = () => {
    console.log('💚 [PlaidAccountManager] Account connected! Refreshing accounts list...');
    // Refresh the connected accounts list
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Connected Accounts</h2>
        <p className="text-muted-foreground mt-2">
          Securely link your bank accounts to automatically track your finances
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

      {/* Benefits Section */}
      <Card className="card-gradient border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Benefits of Connecting Your Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex gap-3">
              <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-semibold text-white">Real-Time Net Worth</h4>
                <p className="text-sm text-gray-400">
                  Track your total assets and liabilities automatically
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <DollarSign className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-semibold text-white">Cash Flow Analysis</h4>
                <p className="text-sm text-gray-400">
                  Understand your income and spending patterns
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-semibold text-white">Better Recommendations</h4>
                <p className="text-sm text-gray-400">
                  Get personalized insights based on your actual finances
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content - No tabs needed since we only have accounts now */}
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
        <ConnectedAccountsList key={refreshKey} />
      </div>
    </div>
  );
}