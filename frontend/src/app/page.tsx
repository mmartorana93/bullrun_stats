'use client';

import React from 'react';
import Analytics from '@/components/Analytics';
import LPAnalytics from '@/components/LPAnalytics';
import WalletManager from '@/components/WalletManager';

export default function Home() {
  const [wallets, setWallets] = React.useState<string[]>([]);

  // Mock data per LPAnalytics
  const mockLPData = {
    priceHistory: [],
    hourlyStats: [],
    riskDistribution: []
  };

  return (
    <div className="w-full">
      <div className="flex space-x-4 mb-4">
        <button className="px-4 py-2">Queries</button>
        <button className="px-4 py-2">Analytics</button>
        <button className="px-4 py-2">LP Analytics</button>
        <button className="px-4 py-2">Wallet Manager</button>
      </div>

      <div>
        <div>Queries Tab Content</div>
        <Analytics />
        <LPAnalytics 
          priceHistory={mockLPData.priceHistory}
          hourlyStats={mockLPData.hourlyStats}
          riskDistribution={mockLPData.riskDistribution}
        />
        <WalletManager 
          wallets={wallets}
          onWalletsUpdate={setWallets}
        />
      </div>
    </div>
  );
} 