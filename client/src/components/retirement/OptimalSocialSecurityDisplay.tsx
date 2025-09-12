// Component to display optimal Social Security claim ages - all calculations done server-side
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

interface OptimalSSDisplayProps {
  profile: any;
}

export function OptimalSocialSecurityDisplay({ profile }: OptimalSSDisplayProps) {
  const [optimalData, setOptimalData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showNPV, setShowNPV] = useState(true); // Toggle between NPV and Cumulative view
  const { toast } = useToast();

  useEffect(() => {
    const fetchOptimalData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/calculate-optimal-ss-claim', { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setOptimalData(data);
        } else {
          throw new Error('Failed to fetch optimal SS data');
        }
      } catch (error) {
        console.error('Error fetching optimal SS data:', error);
        toast({
          title: "Error",
          description: "Failed to load optimal Social Security recommendations.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (profile) {
      fetchOptimalData();
    }
  }, [profile, toast]);

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardContent className="p-6 text-center">
          <Sparkles className="w-6 h-6 mx-auto animate-pulse text-purple-400" />
          <p className="text-gray-400 mt-2">Calculating optimal strategies...</p>
        </CardContent>
      </Card>
    );
  }

  if (!optimalData || !optimalData.user) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-6 h-6 mx-auto text-amber-400" />
          <p className="text-gray-400 mt-2">No optimal strategy data available. Please complete your profile.</p>
        </CardContent>
      </Card>
    );
  }

  const { user, spouse } = optimalData;

  // Helper to format currency
  const formatCurrency = (value: number): string => {
    const absValue = Math.abs(value);
    const sign = value >= 0 ? '+' : '-';
    return `${sign}$${absValue.toLocaleString()}`;
  };

  // Helper to format percentage
  const formatPercentage = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden">
      <CardHeader 
        className="pb-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-400" />
              Optimal Social Security Strategy
            </CardTitle>
            <p className="text-sm text-gray-400 mt-1">
              {isCollapsed 
                ? `Your optimal age: ${user.optimalAge}${spouse ? `, Spouse optimal age: ${spouse.optimalAge}` : ''} | Click to expand`
                : `Maximizing lifetime benefits ${showNPV ? 'using NPV analysis' : '(cumulative, non-discounted)'} until age 93`
              }
            </p>
          </div>
          {isCollapsed ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </CardHeader>
      
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: "hidden" }}
          >
            <CardContent className="space-y-6">
              {/* Toggle Button for NPV vs Cumulative View */}
              <div className="flex justify-center">
                <div className="bg-gray-800 rounded-lg p-1 flex gap-1">
                  <button
                    onClick={() => setShowNPV(true)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      showNPV 
                        ? 'bg-purple-600 text-white' 
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    NPV (Discounted)
                  </button>
                  <button
                    onClick={() => setShowNPV(false)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      !showNPV 
                        ? 'bg-purple-600 text-white' 
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    Cumulative (Non-Discounted)
                  </button>
                </div>
              </div>

              {/* User Card */}
              <div className="bg-gray-800/50 p-4 rounded-lg border border-purple-700/30">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-white">Your Optimal Age</h3>
                  <span className="text-lg font-bold text-green-400">Age {user.optimalAge}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Monthly Benefit Increase</span>
                    <span className="text-white">
                      {formatPercentage(user.monthlyIncrease)} from Retirement Age
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      Lifetime Value Change {showNPV ? '(NPV)' : '(Cumulative)'}
                    </span>
                    <span className={`font-medium ${
                      (showNPV ? user.npvDifference : user.nominalDifference) >= 0 
                        ? 'text-green-400' 
                        : 'text-red-400'
                    }`}>
                      {formatCurrency(showNPV ? user.npvDifference : user.nominalDifference)} from Retirement Age
                    </span>
                  </div>
                  
                  {/* Comparison Section */}
                  <div className="pt-2 mt-2 border-t border-gray-700">
                    <div className="mb-2">
                      <span className="text-xs text-purple-400 font-medium">
                        {showNPV ? 'Net Present Value Comparison' : 'Cumulative Lifetime Benefits'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">At Retirement ({user.retirementAge})</span>
                      <span className="text-gray-400">
                        ${(showNPV ? user.retirementNPV : user.retirementNominal).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">At Optimal ({user.optimalAge})</span>
                      <span className="text-gray-400">
                        ${(showNPV ? user.optimalNPV : user.optimalNominal).toLocaleString()}
                      </span>
                    </div>
                    {!showNPV && (
                      <div className="mt-2 p-2 bg-amber-900/20 rounded text-xs text-amber-400">
                        💡 The cumulative view shows total lifetime benefits without time value of money. 
                        Delaying to age {user.optimalAge} increases total benefits by ${user.nominalDifference?.toLocaleString() || '0'}.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Spouse Card if married */}
              {spouse && (
                <div className="bg-gray-800/50 p-4 rounded-lg border-gray-700/30">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-white">Spouse Optimal Age</h3>
                    <span className="text-lg font-bold text-green-400">Age {spouse.optimalAge}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Monthly Benefit Increase</span>
                      <span className="text-white">
                        {formatPercentage(spouse.monthlyIncrease)} from Retirement Age
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">
                        Lifetime Value Change {showNPV ? '(NPV)' : '(Cumulative)'}
                      </span>
                      <span className={`font-medium ${
                        (showNPV ? spouse.npvDifference : spouse.nominalDifference) >= 0 
                          ? 'text-green-400' 
                          : 'text-red-400'
                      }`}>
                        {formatCurrency(showNPV ? spouse.npvDifference : spouse.nominalDifference)} from Retirement Age
                      </span>
                    </div>
                    
                    {/* Comparison Section */}
                    <div className="pt-2 mt-2 border-t border-gray-700">
                      <div className="mb-2">
                        <span className="text-xs text-purple-400 font-medium">
                          {showNPV ? 'Net Present Value Comparison' : 'Cumulative Lifetime Benefits'}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">At Retirement ({spouse.retirementAge})</span>
                        <span className="text-gray-400">
                          ${(showNPV ? spouse.retirementNPV : spouse.retirementNominal).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">At Optimal ({spouse.optimalAge})</span>
                        <span className="text-gray-400">
                          ${(showNPV ? spouse.optimalNPV : spouse.optimalNominal).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Combined Summary for Couples */}
              {spouse && (
                <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 p-4 rounded-lg border border-purple-600/30">
                  <h4 className="text-sm font-medium text-purple-300 mb-2">Combined Household Impact</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Total {showNPV ? 'NPV' : 'Cumulative'} Gain</p>
                      <p className="text-xl font-bold text-green-400">
                        {formatCurrency(
                          showNPV 
                            ? (user.npvDifference + spouse.npvDifference)
                            : ((user.nominalDifference || 0) + (spouse.nominalDifference || 0))
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Strategy</p>
                      <p className="text-xs text-gray-300">
                        You claim at {user.optimalAge}, Spouse at {spouse.optimalAge}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Insights */}
              <div className="text-xs text-gray-400 space-y-1">
                {showNPV ? (
                  <>
                    <p>NPV analysis accounts for the time value of money using a 3% discount rate.</p>
                    <p>This shows the present value of all future benefits, making earlier dollars worth more.</p>
                  </>
                ) : (
                  <>
                    <p>Cumulative view shows total lifetime benefits without discounting.</p>
                    <p>This demonstrates the raw dollar advantage of delaying, assuming you live to age 93.</p>
                  </>
                )}
                <p>Analysis assumes 2.5% annual COLA adjustments and standard SS claiming rules.</p>
                {spouse && <p>Coordinated strategy considers spousal and survivor benefits.</p>}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}