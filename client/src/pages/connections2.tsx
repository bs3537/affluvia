import React from 'react';
import { PlaidAccountManagerDirect } from '@/components/plaid/PlaidAccountManagerDirect';

export function Connections2() {
  return (
    <div className="min-h-screen bg-gray-900">
      <div className="p-6">
        <PlaidAccountManagerDirect />
      </div>
    </div>
  );
}

export default Connections2;