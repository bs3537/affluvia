import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  ChevronDown,
  ChevronUp,
  DollarSign,
  Sparkles,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Banknote,
  Receipt,
  PiggyBank,
  Calculator,
  CreditCard,
  Home
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LastCalculated } from './ui/last-calculated';
import { useDashboardSnapshot, pickWidget } from '@/hooks/useDashboardSnapshot';
import { RefreshCw } from 'lucide-react';

interface CashFlowBreakdown {
  // Income
  takeHomeIncome: number;
  spouseTakeHomeIncome: number;
  otherIncome: number;
  totalMonthlyIncome: number;
  
  // Expenses
  categorizedExpenses: number;
  housingExpenses: number;
  transportationExpenses: number;
  foodExpenses: number;
  otherExpenses: number;
  totalMonthlyExpenses: number;
  expenseSource: 'categorized' | 'manual_override' | 'plaid_imported' | 'persisted';
  
  // Cash Flow
  monthlyRetirementContributions: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  savingsRate: number;
}

export function CashFlowWidgetV2() {
  // Simplified widget (no expandable details or recommendations)
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

  // Snapshot for instant cash flow
  const { data: dashSnapshot } = useDashboardSnapshot();
  const snapCash = pickWidget<any>(dashSnapshot, 'cash_flow');

  // Calculate cash flow breakdown (prefers persisted DB values)
  const calculateCashFlow = (): CashFlowBreakdown => {
    if (!profile) {
      return {
        takeHomeIncome: 0,
        spouseTakeHomeIncome: 0,
        otherIncome: 0,
        totalMonthlyIncome: 0,
        categorizedExpenses: 0,
        housingExpenses: 0,
        transportationExpenses: 0,
        foodExpenses: 0,
        otherExpenses: 0,
        totalMonthlyExpenses: 0,
        expenseSource: 'categorized',
        monthlyRetirementContributions: 0,
        monthlyCashFlow: 0,
        annualCashFlow: 0,
        savingsRate: 0
      };
    }
    
    // Prefer persisted server-side calculations when available
    const calc = profile.calculations || {};
    
    // Expenses (from Step 5) — used for category breakdown when available
    const monthlyExpensesObj = profile.monthlyExpenses || {};
    const housingExpenses = parseFloat(monthlyExpensesObj.housing) || 0;
    const transportationExpenses = parseFloat(monthlyExpensesObj.transportation) || 0;
    const foodExpenses = parseFloat(monthlyExpensesObj.food) || 0;
    
    const categorizedExpenses = Object.entries(monthlyExpensesObj)
      .filter(([key]) => !key.startsWith('_') && key !== 'total')
      .reduce((sum: number, [, expense]: [string, any]) => sum + (parseFloat(expense) || 0), 0);
    
    const manualTotalExpenses = parseFloat(profile.totalMonthlyExpenses) || parseFloat(monthlyExpensesObj.total) || 0;
    const plaidImportedExpenses = monthlyExpensesObj._lastAutoFill?.total || 0;
    
    let derivedMonthlyExpenses = 0;
    let expenseSource: 'categorized' | 'manual_override' | 'plaid_imported' | 'persisted' = 'categorized';
    
    if (typeof calc.monthlyExpenses === 'number' && calc.monthlyExpenses > 0) {
      derivedMonthlyExpenses = calc.monthlyExpenses;
      expenseSource = 'persisted';
    } else if (categorizedExpenses > 0) {
      derivedMonthlyExpenses = categorizedExpenses;
      expenseSource = 'categorized';
    } else if (manualTotalExpenses > 0) {
      derivedMonthlyExpenses = manualTotalExpenses;
      expenseSource = 'manual_override';
    } else if (plaidImportedExpenses > 0) {
      derivedMonthlyExpenses = plaidImportedExpenses;
      expenseSource = 'plaid_imported';
    }
    
    // Income (prefer persisted from calculations; falls back to take-home derivation)
    const persistedMonthlyIncome = typeof calc.monthlyIncome === 'number' ? calc.monthlyIncome : undefined;
    const takeHomeIncome = parseFloat(profile.takeHomeIncome) || 0;
    const spouseTakeHomeIncome = parseFloat(profile.spouseTakeHomeIncome) || 0;
    const otherIncome = parseFloat(profile.otherIncome) || 0;
    const totalAnnualTakeHome = takeHomeIncome + spouseTakeHomeIncome + otherIncome;
    const derivedMonthlyIncome = persistedMonthlyIncome ?? (totalAnnualTakeHome / 12);
    
    // Retirement contributions (Step 11 + IRA annuals -> monthly)
    const userRetirement = profile?.retirementContributions || { employee: 0, employer: 0 };
    const spouseRetirement = profile?.spouseRetirementContributions || { employee: 0, employer: 0 };
    let monthlyRetirementContributions = (Number(userRetirement.employee) || 0) + (Number(spouseRetirement.employee) || 0);
    const monthlyTraditionalIRA = (Number(profile?.traditionalIRAContribution) || 0) / 12;
    const monthlyRothIRA = (Number(profile?.rothIRAContribution) || 0) / 12;
    const monthlySpouseTraditionalIRA = (Number(profile?.spouseTraditionalIRAContribution) || 0) / 12;
    const monthlySpouseRothIRA = (Number(profile?.spouseRothIRAContribution) || 0) / 12;
    monthlyRetirementContributions += monthlyTraditionalIRA + monthlyRothIRA + monthlySpouseTraditionalIRA + monthlySpouseRothIRA;

    // Cash flow: if a persisted monthly cash flow exists, assume it's already net of contributions (avoid double counting)
    const persistedMonthlyCashFlow =
      (typeof profile.monthlyCashFlow === 'number' ? (profile.monthlyCashFlow as number) : undefined) ??
      (typeof calc.monthlyCashFlow === 'number' ? calc.monthlyCashFlow : undefined);
    const monthlyCashFlow = typeof persistedMonthlyCashFlow === 'number'
      ? persistedMonthlyCashFlow
      : (derivedMonthlyIncome - derivedMonthlyExpenses - monthlyRetirementContributions);
    
    const annualCashFlow = monthlyCashFlow * 12;
    // Recompute savings rate to reflect contributions impact
    const savingsRate = (derivedMonthlyIncome > 0 ? (monthlyCashFlow / derivedMonthlyIncome) * 100 : 0);
    
    const otherExpenses = categorizedExpenses - housingExpenses - transportationExpenses - foodExpenses;
    
    return {
      takeHomeIncome,
      spouseTakeHomeIncome,
      otherIncome,
      totalMonthlyIncome: derivedMonthlyIncome,
      categorizedExpenses,
      housingExpenses,
      transportationExpenses,
      foodExpenses,
      otherExpenses,
      totalMonthlyExpenses: derivedMonthlyExpenses,
      expenseSource: expenseSource as any,
      monthlyRetirementContributions,
      monthlyCashFlow,
      annualCashFlow,
      savingsRate
    };
  };

  const breakdown = calculateCashFlow();

  // Recommendations and detailed breakdown removed

  if (isLoading && typeof snapCash?.monthly !== 'number') {
    return (
      <div className="card-gradient rounded-2xl p-6 animate-pulse border border-gray-700">
        <div className="h-8 bg-gray-800 rounded w-32 mb-4"></div>
        <div className="h-12 bg-gray-800 rounded w-48 mb-2"></div>
        <div className="h-4 bg-gray-800 rounded w-24"></div>
      </div>
    );
  }

  const snapMonthly = (typeof snapCash?.monthly === 'number') ? Number(snapCash.monthly) : undefined;
  const displayMonthlyCashFlow = (typeof snapMonthly === 'number') ? snapMonthly : breakdown.monthlyCashFlow;
  const isPositive = displayMonthlyCashFlow >= 0;

  const lastCalculatedTs = profile?.calculations?.calculatedAt || profile?.lastUpdated || null;

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await fetch(`/api/financial-profile?refresh=true&syncPlaid=true&t=${Date.now()}` , { credentials: 'include' });
      await queryClient.invalidateQueries({ queryKey: ['financial-profile'] });
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
            <DollarSign className="h-5 w-5 text-purple-400" />
            Cash Flow
          </h3>
          <p className="text-gray-400 text-sm mt-1">Monthly income vs expenses</p>
        </div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`p-2 rounded-lg ${isPositive ? 'bg-green-900/20' : 'bg-red-900/20'}`}
        >
          {isPositive ? (
            <ArrowUpRight className={`h-5 w-5 ${isPositive ? 'text-green-400' : 'text-red-400'}`} />
          ) : (
            <ArrowDownRight className="h-5 w-5 text-red-400" />
          )}
        </motion.div>
      </div>

      {/* Meta row: last calculated + refresh */}
      <LastCalculated timestamp={lastCalculatedTs} onRefresh={handleRefresh} refreshing={refreshing} />

      {/* Cash Flow Display */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className={`text-4xl font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {formatCurrency(displayMonthlyCashFlow)}
          <span className="text-lg font-normal text-gray-400">/mo</span>
        </div>
        <div className="mt-2 flex items-center gap-4">
          <div className={`text-sm px-3 py-1 rounded-full inline-block ${
            isPositive ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'
          }`}>
            {isPositive ? 'Positive Cash Flow' : 'Negative Cash Flow'}
          </div>
          {breakdown.savingsRate !== 0 && (
            <div className="text-sm text-gray-400">
              Savings Rate: <span className={breakdown.savingsRate >= 20 ? 'text-green-400' : 'text-yellow-400'}>
                {Math.abs(breakdown.savingsRate).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Details & recommendations removed */}
      {/* <motion.div className="border-t border-gray-800 pt-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-left hover:bg-gray-800/30 rounded-lg p-2 transition-colors"
        >
          <span className="text-white font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-purple-400" />
            View Details & Recommendations
          </span>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 space-y-4"
            >
              Cash Flow Breakdown
              <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg p-4 border border-purple-800/30">
                <h4 className="text-purple-400 font-semibold mb-3">Cash Flow Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Monthly Income (after tax)</span>
                    <span className="text-green-400">+{formatCurrency(breakdown.totalMonthlyIncome)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Monthly Expenses ({breakdown.expenseSource.replace('_', ' ')})</span>
                    <span className="text-red-400">-{formatCurrency(breakdown.totalMonthlyExpenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Retirement Contributions</span>
                    <span className="text-orange-400">-{formatCurrency(breakdown.monthlyRetirementContributions)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-purple-700">
                    <span className="text-white">Monthly Cash Flow</span>
                    <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
                      {formatCurrency(breakdown.monthlyCashFlow)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs pt-1">
                    <span className="text-gray-500">Annual Cash Flow</span>
                    <span className={`${isPositive ? 'text-green-400/70' : 'text-red-400/70'}`}>
                      {formatCurrency(breakdown.annualCashFlow)}
                    </span>
                  </div>
                </div>
                
                How to Improve Cash Flow
                <div className="mt-6">
                  <h4 className="text-yellow-400 font-semibold mb-4 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    How to Improve Cash Flow
                  </h4>
                  
                  <div className="space-y-3">
                    {suggestions.map((suggestion, index) => {
                      const Icon = suggestion.icon;
                      return (
                        <motion.div
                          key={index}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: index * 0.1 }}
                          className="bg-gray-800/30 rounded-lg p-4 border border-gray-700 hover:border-purple-700/50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${
                              suggestion.impact === 'high' ? 'bg-green-900/20' :
                              suggestion.impact === 'medium' ? 'bg-yellow-900/20' :
                              'bg-blue-900/20'
                            }`}>
                              <Icon className={`h-5 w-5 ${
                                suggestion.impact === 'high' ? 'text-green-400' :
                                suggestion.impact === 'medium' ? 'text-yellow-400' :
                                'text-blue-400'
                              }`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h5 className="text-white font-medium">{suggestion.title}</h5>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  suggestion.impact === 'high' ? 'bg-green-900/30 text-green-400' :
                                  suggestion.impact === 'medium' ? 'bg-yellow-900/30 text-yellow-400' :
                                  'bg-blue-900/30 text-blue-400'
                                }`}>
                                  {suggestion.impact} impact
                                </span>
                              </div>
                              <p className="text-gray-400 text-sm">{suggestion.description}</p>
                              {suggestion.potentialSavings && suggestion.potentialSavings > 0 && (
                                <p className="text-green-400 text-xs mt-1">
                                  Potential: +{formatCurrency(suggestion.potentialSavings)}/year
                                </p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}

                    {generateSuggestions.isPending && (
                      <div className="text-center py-4">
                        <div className="inline-flex items-center gap-2 text-gray-400">
                          <Sparkles className="h-4 w-4 animate-pulse" />
                          <span className="text-sm">Generating personalized suggestions...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      */}
    </div>
  );
}
