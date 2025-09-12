import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart3, 
  TrendingDown, 
  Calendar, 
  DollarSign, 
  PiggyBank,
  Info,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Heart,
  Briefcase,
  Home
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Cell } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

interface WithdrawalData {
  year: number;
  age: number;
  spouseAge?: number;
  monthlyExpenses: number;
  
  // Income sources
  socialSecurity: number;
  spouseSocialSecurity?: number;
  pension: number;
  spousePension?: number;
  partTimeIncome: number;
  spousePartTimeIncome?: number;
  
  // Withdrawals by account type
  taxableWithdrawal: number;
  taxDeferredWithdrawal: number;
  taxFreeWithdrawal: number;
  hsaWithdrawal: number;
  
  // Remaining balances
  taxableBalance: number;
  taxDeferredBalance: number;
  taxFreeBalance: number;
  hsaBalance: number;
  
  // Summary
  totalIncome: number;
  totalWithdrawals: number;
  totalBalance: number;
  withdrawalTax: number;
  netIncome: number;
  rmdAmount?: number;
}

interface Props {
  variables: any;
  isOptimized?: boolean;
}

export default function WithdrawalSequenceVisualization({ variables, isOptimized = false }: Props) {
  const [baselineData, setBaselineData] = useState<WithdrawalData[] | null>(null);
  const [optimizedData, setOptimizedData] = useState<WithdrawalData[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState(isOptimized ? 'optimized' : 'baseline');
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  // Fetch withdrawal sequence data
  useEffect(() => {
    fetchWithdrawalData();
  }, [variables]);
  
  const fetchWithdrawalData = async () => {
    setIsLoading(true);
    try {
      // Fetch baseline data
      const baselineResponse = await fetch('/api/calculate-withdrawal-sequence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (baselineResponse.ok) {
        const baselineResult = await baselineResponse.json();
        setBaselineData(baselineResult.projections);
        
        // Set initial selected year to retirement year
        if (baselineResult.projections && baselineResult.projections.length > 0) {
          setSelectedYear(baselineResult.projections[0].year);
        }
      }
      
      // Fetch optimized data if variables are provided
      if (variables && Object.keys(variables).length > 0) {
        const optimizedResponse = await fetch('/api/calculate-optimized-withdrawal-sequence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(variables),
        });
        
        if (optimizedResponse.ok) {
          const optimizedResult = await optimizedResponse.json();
          setOptimizedData(optimizedResult.projections);
        }
      }
    } catch (error) {
      console.error('Error fetching withdrawal data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Get current data based on active tab
  const currentData = activeTab === 'optimized' && optimizedData ? optimizedData : baselineData;
  const selectedYearData = currentData?.find(d => d.year === selectedYear);
  
  // Calculate key metrics
  const metrics = useMemo(() => {
    if (!currentData) return null;
    
    const taxableDepletion = currentData.find(d => d.taxableBalance <= 0);
    const taxDeferredDepletion = currentData.find(d => d.taxDeferredBalance <= 0);
    const firstRMDYear = currentData.find(d => d.rmdAmount && d.rmdAmount > 0);
    const totalLifetimeTax = currentData.reduce((sum, d) => sum + d.withdrawalTax, 0);
    
    return {
      taxableDepletionYear: taxableDepletion?.year || 'Never',
      taxDeferredDepletionYear: taxDeferredDepletion?.year || 'Never',
      firstRMDYear: firstRMDYear?.year || 'N/A',
      estimatedLifetimeTax: totalLifetimeTax,
    };
  }, [currentData]);
  
  // Format currency
  const formatCurrency = (amount: number) => {
    const absAmount = Math.abs(amount);
    if (absAmount >= 1000000) {
      return `${amount < 0 ? '-' : ''}$${(absAmount / 1000000).toFixed(1)}M`;
    } else if (absAmount >= 1000) {
      return `${amount < 0 ? '-' : ''}$${(absAmount / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Chart data preparation
  const chartData = useMemo(() => {
    if (!currentData) return [];
    
    // Sample every 3rd year for better visualization
    return currentData.filter((_, index) => index % 3 === 0 || index === currentData.length - 1);
  }, [currentData]);

  // Show ALL account balance data for scrollable view
  const displayedAccountBalanceData = useMemo(() => {
    if (!currentData) return [];
    // Return all years for complete scrollable view
    return currentData;
  }, [currentData]);

  // Auto-scroll to selected year when it changes
  useEffect(() => {
    if (selectedYear && tableContainerRef.current) {
      const selectedRow = tableContainerRef.current.querySelector(`[data-year="${selectedYear}"]`);
      if (selectedRow) {
        selectedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedYear]);
  
  // Custom tooltip for bar chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = currentData?.find(d => d.year === label);
      if (!data) return null;
      
      return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl">
          <p className="text-white font-semibold mb-2">Year {label} (Age {data.age}{data.spouseAge ? `/${data.spouseAge}` : ''})</p>
          <div className="space-y-1 text-sm">
            {(data as any).workingIncome > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-purple-400">Employment:</span>
                <span className="text-white font-medium">{formatCurrency((data as any).workingIncome)}</span>
              </div>
            )}
            {(data as any).spouseWorkingIncome > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-purple-400">Spouse Employment:</span>
                <span className="text-white font-medium">{formatCurrency((data as any).spouseWorkingIncome)}</span>
              </div>
            )}
            {data.socialSecurity > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-400">Social Security:</span>
                <span className="text-white font-medium">{formatCurrency(data.socialSecurity)}</span>
              </div>
            )}
            {data.pension > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-purple-300">Pension:</span>
                <span className="text-white font-medium">{formatCurrency(data.pension)}</span>
              </div>
            )}
            {data.taxableWithdrawal > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-green-400">Taxable:</span>
                <span className="text-white font-medium">{formatCurrency(data.taxableWithdrawal)}</span>
              </div>
            )}
            {data.taxDeferredWithdrawal > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-amber-400">Tax-Deferred:</span>
                <span className="text-white font-medium">{formatCurrency(data.taxDeferredWithdrawal)}</span>
              </div>
            )}
            {data.taxFreeWithdrawal > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-blue-400">Tax-Free:</span>
                <span className="text-white font-medium">{formatCurrency(data.taxFreeWithdrawal)}</span>
              </div>
            )}
            <div className="border-t border-gray-600 pt-1 mt-1">
              <div className="flex justify-between gap-4">
                <span className="text-purple-400 font-semibold">Total Income:</span>
                <span className="text-white font-bold">{formatCurrency(data.totalIncome + data.totalWithdrawals)}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };
  
  if (isLoading) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        <p className="mt-2">Calculating withdrawal sequences...</p>
      </div>
    );
  }
  
  if (!currentData || currentData.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No withdrawal data available</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Tabs for Baseline vs Optimized */}
      {optimizedData && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-gray-900/50 border border-gray-800 p-1 grid grid-cols-2 w-full max-w-md mx-auto">
            <TabsTrigger 
              value="baseline" 
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:text-gray-300 transition-all font-medium"
            >
              Baseline Plan
            </TabsTrigger>
            <TabsTrigger 
              value="optimized" 
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:text-gray-300 transition-all font-medium"
            >
              Optimized Plan
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      
      {/* Educational Alert */}
      <Alert className="bg-gray-900/50 border-gray-800">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-gray-400">
          <strong className="text-gray-300">Tax-Efficient Withdrawal Order:</strong> Your plan withdraws from taxable accounts first, 
          then tax-deferred accounts (401k/IRA), and finally tax-free Roth accounts. This sequence minimizes 
          lifetime taxes and maximizes account longevity.
        </AlertDescription>
      </Alert>
      
      {/* Summary Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400">Taxable Depletion</p>
                  <p className="text-2xl font-bold text-green-400 mt-1">{metrics.taxableDepletionYear}</p>
                  <p className="text-xs text-gray-500 mt-1">Year taxable accounts empty</p>
                </div>
                <TrendingDown className="w-5 h-5 text-green-400 opacity-20" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400">First RMD Year</p>
                  <p className="text-2xl font-bold text-amber-400 mt-1">{metrics.firstRMDYear}</p>
                  <p className="text-xs text-gray-500 mt-1">Required distributions begin</p>
                </div>
                <Calendar className="w-5 h-5 text-amber-400 opacity-20" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400">Lifetime Taxes</p>
                  <p className="text-2xl font-bold text-red-400 mt-1">{formatCurrency(metrics.estimatedLifetimeTax)}</p>
                  <p className="text-xs text-gray-500 mt-1">Total withdrawal taxes</p>
                </div>
                <DollarSign className="w-5 h-5 text-red-400 opacity-20" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400">Tax-Free Balance</p>
                  <p className="text-2xl font-bold text-blue-400 mt-1">
                    {formatCurrency(selectedYearData?.taxFreeBalance || 0)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Roth IRA balance</p>
                </div>
                <PiggyBank className="w-5 h-5 text-blue-400 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Main Visualization - Stacked Bar Chart */}
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-green-500"></div>
        <CardHeader>
          <CardTitle className="text-lg text-white">Retirement Income Sources Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                onClick={(data) => {
                  if (data && data.activeLabel) {
                    setSelectedYear(parseInt(data.activeLabel));
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="year" 
                  stroke="#6B7280"
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  angle={-45}
                  textAnchor="end"
                />
                <YAxis 
                  stroke="#6B7280"
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="rect"
                />
                
                {/* Income Sources Stacked */}
                <Bar dataKey="workingIncome" stackId="income" fill="#A855F7" name="Employment Income" />
                <Bar dataKey="spouseWorkingIncome" stackId="income" fill="#9333EA" name="Spouse Employment" />
                <Bar dataKey="socialSecurity" stackId="income" fill="#9CA3AF" name="Social Security" />
                <Bar dataKey="pension" stackId="income" fill="#8B5CF6" name="Pension" />
                <Bar dataKey="partTimeIncome" stackId="income" fill="#EC4899" name="Part-Time Income" />
                
                {/* Withdrawals Stacked */}
                <Bar dataKey="taxableWithdrawal" stackId="income" fill="#10B981" name="Taxable Accounts" />
                <Bar dataKey="taxDeferredWithdrawal" stackId="income" fill="#F59E0B" name="Tax-Deferred (401k/IRA)" />
                <Bar dataKey="taxFreeWithdrawal" stackId="income" fill="#3B82F6" name="Tax-Free (Roth)" />
                <Bar dataKey="hsaWithdrawal" stackId="income" fill="#06B6D4" name="HSA" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
      {/* Detailed Year View */}
      {selectedYearData && (
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white">
                Year {selectedYearData.year} Details (Age {selectedYearData.age})
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <Select 
                    value={selectedYear?.toString() || ''} 
                    onValueChange={(value) => setSelectedYear(parseInt(value))}
                  >
                    <SelectTrigger className="w-[140px] bg-gray-800 border-gray-700 text-gray-300">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      {currentData?.map((item) => (
                        <SelectItem 
                          key={item.year} 
                          value={item.year.toString()}
                          className="text-gray-300 hover:bg-gray-700 focus:bg-gray-700"
                        >
                          {item.year} (Age {item.age})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const currentIndex = currentData.findIndex(d => d.year === selectedYear);
                      if (currentIndex > 0) {
                        setSelectedYear(currentData[currentIndex - 1].year);
                      }
                    }}
                    disabled={!currentData || currentData.length === 0 || selectedYear === currentData[0]?.year}
                    className="bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300 w-8 h-8 p-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const currentIndex = currentData.findIndex(d => d.year === selectedYear);
                      if (currentIndex < currentData.length - 1) {
                        setSelectedYear(currentData[currentIndex + 1].year);
                      }
                    }}
                    disabled={!currentData || currentData.length === 0 || selectedYear === currentData[currentData.length - 1]?.year}
                    className="bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300 w-8 h-8 p-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Income Sources */}
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Income Sources</h4>
                <div className="space-y-2">
                  {(selectedYearData as any).workingIncome > 0 && (
                    <div className="flex justify-between items-center p-2 bg-purple-900/20 rounded border border-purple-800/50">
                      <span className="text-sm text-purple-300">Employment Income</span>
                      <span className="text-sm font-medium text-purple-200">{formatCurrency((selectedYearData as any).workingIncome)}</span>
                    </div>
                  )}
                  {(selectedYearData as any).spouseWorkingIncome > 0 && (
                    <div className="flex justify-between items-center p-2 bg-purple-900/20 rounded border border-purple-800/50">
                      <span className="text-sm text-purple-300">Spouse Employment</span>
                      <span className="text-sm font-medium text-purple-200">{formatCurrency((selectedYearData as any).spouseWorkingIncome)}</span>
                    </div>
                  )}
                  {selectedYearData.socialSecurity > 0 && (
                    <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded border border-gray-700">
                      <span className="text-sm text-gray-400">Social Security</span>
                      <span className="text-sm font-medium text-gray-200">{formatCurrency(selectedYearData.socialSecurity)}</span>
                    </div>
                  )}
                  {selectedYearData.pension > 0 && (
                    <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded border border-gray-700">
                      <span className="text-sm text-gray-400">Pension</span>
                      <span className="text-sm font-medium text-gray-200">{formatCurrency(selectedYearData.pension)}</span>
                    </div>
                  )}
                  {selectedYearData.partTimeIncome > 0 && (
                    <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded border border-gray-700">
                      <span className="text-sm text-gray-400">Part-Time Income</span>
                      <span className="text-sm font-medium text-gray-200">{formatCurrency(selectedYearData.partTimeIncome)}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Account Withdrawals */}
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Account Withdrawals</h4>
                <div className="space-y-2">
                  {selectedYearData.taxableWithdrawal > 0 && (
                    <div className="flex justify-between items-center p-2 bg-green-900/30 rounded border border-green-800/50">
                      <span className="text-sm text-green-300">Taxable Accounts</span>
                      <span className="text-sm font-medium text-green-400">{formatCurrency(selectedYearData.taxableWithdrawal)}</span>
                    </div>
                  )}
                  {selectedYearData.taxDeferredWithdrawal > 0 && (
                    <div className="flex justify-between items-center p-2 bg-amber-900/30 rounded border border-amber-800/50">
                      <span className="text-sm text-amber-300">Tax-Deferred (401k/IRA)</span>
                      <span className="text-sm font-medium text-amber-400">{formatCurrency(selectedYearData.taxDeferredWithdrawal)}</span>
                    </div>
                  )}
                  {selectedYearData.taxFreeWithdrawal > 0 && (
                    <div className="flex justify-between items-center p-2 bg-blue-900/30 rounded border border-blue-800/50">
                      <span className="text-sm text-blue-300">Tax-Free (Roth)</span>
                      <span className="text-sm font-medium text-blue-400">{formatCurrency(selectedYearData.taxFreeWithdrawal)}</span>
                    </div>
                  )}
                  {selectedYearData.hsaWithdrawal > 0 && (
                    <div className="flex justify-between items-center p-2 bg-cyan-900/30 rounded border border-cyan-800/50">
                      <span className="text-sm text-cyan-300">HSA</span>
                      <span className="text-sm font-medium text-cyan-400">{formatCurrency(selectedYearData.hsaWithdrawal)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Summary */}
            <div className="mt-6 pt-6 border-t border-gray-700">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-400">Monthly Expenses</p>
                  <p className="text-lg font-semibold text-white">{formatCurrency(selectedYearData.monthlyExpenses)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total Income</p>
                  <p className="text-lg font-semibold text-white">{formatCurrency(selectedYearData.totalIncome + selectedYearData.totalWithdrawals)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Withdrawal Tax</p>
                  <p className="text-lg font-semibold text-red-400">{formatCurrency(selectedYearData.withdrawalTax)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Net Income</p>
                  <p className="text-lg font-semibold text-green-400">{formatCurrency(selectedYearData.netIncome)}</p>
                </div>
              </div>
            </div>
            
            {/* RMD Alert */}
            {selectedYearData.rmdAmount && selectedYearData.rmdAmount > 0 && (
              <Alert className="bg-amber-900/20 border-amber-800/50 mt-4">
                <AlertCircle className="h-4 w-4 text-amber-400" />
                <AlertDescription className="text-amber-300">
                  Required Minimum Distribution (RMD): {formatCurrency(selectedYearData.rmdAmount)}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Account Balances Table - Scrollable with ALL Years */}
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-blue-500"></div>
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center justify-between">
            <span>Account Balance Projections - All Years</span>
            {displayedAccountBalanceData.length > 0 && (
              <span className="text-sm font-normal text-gray-400">
                {displayedAccountBalanceData.length} years ({displayedAccountBalanceData[0].year} - {displayedAccountBalanceData[displayedAccountBalanceData.length - 1].year})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Scrollable container with max height */}
          <div ref={tableContainerRef} className="overflow-auto max-h-96 border border-gray-700 rounded-lg">
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-800 z-10">
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-800">Year</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-800">Age</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-800">Taxable</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-800">Tax-Deferred</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-800">Tax-Free</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-800">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {displayedAccountBalanceData.map((row) => (
                  <tr 
                    key={row.year}
                    data-year={row.year}
                    className={`${row.year === selectedYear ? 'bg-purple-900/20 border-l-4 border-purple-500' : ''} hover:bg-gray-800/50 cursor-pointer transition-all`}
                    onClick={() => setSelectedYear(row.year)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-400">{row.year}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{row.age}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="text-green-400 font-medium">
                        {formatCurrency(row.taxableBalance)}
                      </div>
                      {row.taxableWithdrawal > 0 && (
                        <div className="text-xs text-gray-500">-{formatCurrency(row.taxableWithdrawal)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="text-amber-400 font-medium">
                        {formatCurrency(row.taxDeferredBalance)}
                      </div>
                      {row.taxDeferredWithdrawal > 0 && (
                        <div className="text-xs text-gray-500">-{formatCurrency(row.taxDeferredWithdrawal)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="text-blue-400 font-medium">
                        {formatCurrency(row.taxFreeBalance)}
                      </div>
                      {row.taxFreeWithdrawal > 0 && (
                        <div className="text-xs text-gray-500">-{formatCurrency(row.taxFreeWithdrawal)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-white">
                      {formatCurrency(row.totalBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}