import React from 'react';
import { PlaidAccountManager } from '@/components/plaid';

export function Connections() {
  return (
    <div className="min-h-screen bg-gray-900">
      <div className="p-6">
        <PlaidAccountManager />
      </div>
    </div>
  );
}

export default Connections;