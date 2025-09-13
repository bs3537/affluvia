import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  ChevronDown,
  ChevronUp,
  Home,
  Wallet,
  CreditCard,
  Sparkles,
  Target,
  AlertCircle,
  PiggyBank,
  TrendingUpIcon,
  Building
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LastCalculated } from './ui/last-calculated';
import { useDashboardSnapshot, pickWidget } from '@/hooks/useDashboardSnapshot';
import { Button } from './ui/button';
import { RefreshCw } from 'lucide-react';

interface NetWorthBreakdown {
  // Assets from Step 3
  bankAccounts: number;
  investments: number;
  retirementAccounts: number;
  otherAssets: number;
  
  // Real Estate from Step 4
  primaryHomeEquity: number;
  additionalPropertiesEquity: number;
  
  // Liabilities from Step 3
  creditCards: number;
  loans: number;
  otherDebts: number;
  
  // Totals
  totalAssets: number;
  totalRealEstateEquity: number;
  totalLiabilities: number;
  netWorth: number;
}

interface ImprovementSuggestion {
  icon: React.ElementType;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export function NetWorthWidgetV2() {
  // No expandable breakdown or recommendations
  const [suggestions, setSuggestions] = useState<ImprovementSuggestion[]>([]);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  
  // Fetch financial profile data
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['financial-profile'],
    queryFn: async () => {
      const response = await fetch('/api/financial-profile?fast=true', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    }
  });

  // Snapshot for instant net worth
  const { data: dashSnapshot } = useDashboardSnapshot();
  const snapNetWorth = pickWidget<any>(dashSnapshot, 'net_worth');

  // Generate AI suggestions
  const generateSuggestions = useMutation({
    mutationFn: async (netWorthData: NetWorthBreakdown) => {
      const response = await fetch('/api/generate-net-worth-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ netWorthData, profile })
      });
      if (!response.ok) throw new Error('Failed to generate suggestions');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }
    }
  });

  // Calculate net worth breakdown
  const calculateNetWorth = (): NetWorthBreakdown => {
    if (!profile) {
      return {
        bankAccounts: 0,
        investments: 0,
        retirementAccounts: 0,
        otherAssets: 0,
        primaryHomeEquity: 0,
        additionalPropertiesEquity: 0,
        creditCards: 0,
        loans: 0,
        otherDebts: 0,
        totalAssets: 0,
        totalRealEstateEquity: 0,
        totalLiabilities: 0,
        netWorth: 0
      };
    }

    // Step 3: Assets
    const assets = Array.isArray(profile.assets) ? profile.assets : [];
    let bankAccounts = 0;
    let investments = 0;
    let retirementAccounts = 0;
    let otherAssets = 0;

    assets.forEach((asset: any) => {
      const value = parseFloat(asset.value) || 0;
      const type = (asset.type || '').toLowerCase();
      
      if (type.includes('checking') || type.includes('savings')) {
        bankAccounts += value;
      } else if (type.includes('investment') || type.includes('brokerage')) {
        investments += value;
      } else if (type.includes('401k') || type.includes('ira') || type.includes('retirement')) {
        retirementAccounts += value;
      } else {
        otherAssets += value;
      }
    });

    // Step 4: Real Estate
    const primaryResidence = profile.primaryResidence || {};
    const primaryHomeValue = parseFloat(primaryResidence.marketValue) || 0;
    const primaryMortgage = parseFloat(primaryResidence.mortgageBalance) || 0;
    const primaryHomeEquity = primaryHomeValue - primaryMortgage;

    const additionalProperties = Array.isArray(profile.additionalProperties) ? profile.additionalProperties : [];
    const additionalPropertiesEquity = additionalProperties.reduce((sum: number, property: any) => {
      const value = parseFloat(property.marketValue) || 0;
      const mortgage = parseFloat(property.mortgageBalance) || 0;
      return sum + (value - mortgage);
    }, 0);

    // Step 3: Liabilities
    const liabilities = Array.isArray(profile.liabilities) ? profile.liabilities : [];
    let creditCards = 0;
    let loans = 0;
    let otherDebts = 0;

    liabilities.forEach((liability: any) => {
      const balance = parseFloat(liability.balance) || 0;
      const type = (liability.type || '').toLowerCase();
      
      if (type.includes('credit card')) {
        creditCards += balance;
      } else if (type.includes('loan')) {
        loans += balance;
      } else {
        otherDebts += balance;
      }
    });

    // Calculate totals
    const totalAssets = bankAccounts + investments + retirementAccounts + otherAssets;
    const totalRealEstateEquity = primaryHomeEquity + additionalPropertiesEquity;
    const totalLiabilities = creditCards + loans + otherDebts;
    const netWorth = totalAssets + totalRealEstateEquity - totalLiabilities;

    return {
      bankAccounts,
      investments,
      retirementAccounts,
      otherAssets,
      primaryHomeEquity,
      additionalPropertiesEquity,
      creditCards,
      loans,
      otherDebts,
      totalAssets,
      totalRealEstateEquity,
      totalLiabilities,
      netWorth
    };
  };

  const breakdown = calculateNetWorth();

  // Generate suggestions when breakdown changes
  useEffect(() => {
    if (breakdown.netWorth !== 0 && !suggestions.length) {
      // Default suggestions if API fails
      const defaultSuggestions: ImprovementSuggestion[] = [
        {
          icon: PiggyBank,
          title: 'Maximize High-Yield Savings',
          description: breakdown.bankAccounts > 50000 
            ? 'Consider moving excess cash to high-yield savings or money market accounts earning 4-5% APY'
            : 'Build your emergency fund to 3-6 months of expenses in a high-yield savings account',
          impact: 'high'
        },
        {
          icon: CreditCard,
          title: breakdown.creditCards > 0 ? 'Eliminate High-Interest Debt' : 'Optimize Credit Usage',
          description: breakdown.creditCards > 0
            ? `Pay off credit cards to save ${formatCurrency(breakdown.creditCards * 0.20)} annually in interest`
            : 'Use cashback credit cards responsibly and pay in full monthly to earn rewards',
          impact: breakdown.creditCards > 10000 ? 'high' : 'medium'
        },
        {
          icon: TrendingUpIcon,
          title: 'Increase Investment Contributions',
          description: breakdown.retirementAccounts < 100000
            ? 'Maximize 401(k) match and consider opening a Roth IRA for tax-free growth'
            : 'Consider backdoor Roth conversions and maximize all tax-advantaged accounts',
          impact: 'high'
        }
      ];
      
      setSuggestions(defaultSuggestions);
      
      // Try to get AI suggestions
      generateSuggestions.mutate(breakdown);
    }
  }, [breakdown.netWorth]);

  if (isLoading && typeof snapNetWorth?.value !== 'number') {
    return (
      <div className="card-gradient rounded-2xl p-6 animate-pulse border border-gray-700">
        <div className="h-8 bg-gray-800 rounded w-32 mb-4"></div>
        <div className="h-12 bg-gray-800 rounded w-48 mb-2"></div>
        <div className="h-4 bg-gray-800 rounded w-24"></div>
      </div>
    );
  }

  // Prefer freshly calculated net worth when available; fall back to persisted, then breakdown
  const calculatedNetWorth = (profile?.calculations && typeof profile.calculations.netWorth !== 'undefined')
    ? Number(profile.calculations.netWorth)
    : undefined;
  const persistedNetWorth = (profile && typeof profile.netWorth !== 'undefined' && profile.netWorth !== null)
    ? Number(profile.netWorth)
    : undefined;
  const displayedNetWorth =
    (typeof snapNetWorth?.value === 'number') ? Number(snapNetWorth.value) :
    (typeof calculatedNetWorth === 'number' && isFinite(calculatedNetWorth)) ? calculatedNetWorth :
    (typeof persistedNetWorth === 'number' && isFinite(persistedNetWorth)) ? persistedNetWorth :
    breakdown.netWorth;
  const isPositive = displayedNetWorth >= 0;

  const lastCalculatedTs = profile?.calculations?.calculatedAt || profile?.lastUpdated || null;

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await fetch(`/api/financial-profile?refresh=true&syncPlaid=true&t=${Date.now()}` , { credentials: 'include' });
      // Also trigger a server-side recalculation to update net worth fields
      try {
        await fetch('/api/financial-profile/recalculate', { method: 'POST', credentials: 'include' });
      } catch (_) {}
      await queryClient.invalidateQueries({ queryKey: ['financial-profile'] });
      // Let other widgets listen if they want to regenerate
      window.dispatchEvent(new CustomEvent('refreshDashboard'));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="card-gradient rounded-2xl p-6 border border-gray-700 hover:border-gray-600 transition-all hover-lift">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <Wallet className="h-5 w-5 text-purple-400" />
            Net Worth
          </h3>
          <p className="text-gray-400 text-sm mt-1">Complete financial picture</p>
        </div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`p-2 rounded-lg ${isPositive ? 'bg-green-900/20' : 'bg-red-900/20'}`}
        >
          {isPositive ? (
            <TrendingUp className={`h-5 w-5 ${isPositive ? 'text-green-400' : 'text-red-400'}`} />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-400" />
          )}
        </motion.div>
      </div>

      {/* Meta row: last calculated + refresh */}
      <LastCalculated timestamp={lastCalculatedTs} onRefresh={handleRefresh} refreshing={refreshing} />

      {/* Net Worth Display */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className={`text-4xl font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {formatCurrency(displayedNetWorth)}
        </div>
        <div className={`text-sm mt-2 px-3 py-1 rounded-full inline-block ${
          isPositive ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'
        }`}>
          {isPositive ? 'Positive' : 'Negative'} Net Worth
        </div>
      </motion.div>

      {/* Details & recommendations removed */}
    </div>
  );
}
