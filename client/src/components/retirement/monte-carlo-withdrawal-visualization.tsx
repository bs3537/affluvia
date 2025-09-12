import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Info, TrendingDown, TrendingUp, AlertTriangle, Download } from 'lucide-react';
import { exportAccountBalances } from '@/utils/excel-export';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

interface MonteCarloWithdrawal {
  year: number;
  age: number;
  spouseAge?: number;
  monthlyExpenses: number;
  workingIncome: number;
  spouseWorkingIncome?: number;
  socialSecurity: number;
  spouseSocialSecurity?: number;
  pension: number;
  spousePension?: number;
  partTimeIncome: number;
  spousePartTimeIncome?: number;
  portfolioBalance: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  taxableWithdrawal: number;
  taxDeferredWithdrawal: number;
  taxFreeWithdrawal: number;
  hsaWithdrawal: number;
  taxableBalance: number;
  taxDeferredBalance: number;
  taxFreeBalance: number;
  hsaBalance: number;
  totalIncome: number;
  totalWithdrawals: number;
  totalBalance: number;
  withdrawalTax: number;
  netIncome: number;
  rmdAmount?: number;
  successProbability: number;
  failureYear?: boolean;
}

interface MonteCarloWithdrawalVisualizationProps {
  data: MonteCarloWithdrawal[] | null;
  summary: any;
  selectedPlan: 'baseline' | 'optimized';
  isLoading?: boolean;
  loadingSeconds?: number;
}

export function MonteCarloWithdrawalVisualization({
  data,
  summary,
  selectedPlan,
  isLoading,
  loadingSeconds = 0
}: MonteCarloWithdrawalVisualizationProps) {
  // All hooks must be at the top, before any conditional returns
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  
  // Safe data fallback to prevent hook order issues
  const safeData = Array.isArray(data) ? data : [];
  
  // Calculate key metrics like deterministic tab (safe to compute)
  const taxableDepletionYear = safeData.find(d => d.taxableBalance <= 0)?.year;
  const firstRMDYear = safeData.find(d => d.rmdAmount && d.rmdAmount > 0)?.year;
  const totalLifetimeTax = safeData.reduce((sum, d) => sum + (d.withdrawalTax || 0), 0);
  const finalTaxFreeBalance = safeData[safeData.length - 1]?.taxFreeBalance || 0;
  const currentYear = new Date().getFullYear();
  // Find the earliest retirement year (when either spouse stops working)
  const userRetirementYear = safeData.find(d => d.workingIncome === 0)?.year;
  const spouseRetirementYear = safeData.find(d => d.spouseWorkingIncome === 0)?.year;
  const retirementYear = Math.min(
    userRetirementYear || Infinity,
    spouseRetirementYear || Infinity
  ) === Infinity ? undefined : Math.min(userRetirementYear || Infinity, spouseRetirementYear || Infinity);

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null || isNaN(value)) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number | null | undefined) => {
    if (value == null || isNaN(value)) return '0.0%';
    return `${value.toFixed(1)}%`;
  };

  // All useMemo hooks must be declared before returns
  const incomeChartData = useMemo(() => {
    return safeData.map(year => ({
      year: year.year,
      age: year.age,
      workingIncome: Math.round(year.workingIncome),
      spouseWorkingIncome: Math.round(year.spouseWorkingIncome || 0),
      socialSecurity: Math.round(year.socialSecurity),
      spouseSocialSecurity: Math.round(year.spouseSocialSecurity || 0),
      pension: Math.round(year.pension),
      partTimeIncome: Math.round(year.partTimeIncome),
      taxableWithdrawal: Math.round(year.taxableWithdrawal),
      taxDeferredWithdrawal: Math.round(year.taxDeferredWithdrawal),
      taxFreeWithdrawal: Math.round(year.taxFreeWithdrawal),
      hsaWithdrawal: Math.round(year.hsaWithdrawal)
    }));
  }, [safeData]);

  // Portfolio confidence bands chart removed for this tab to avoid duplication

  // useEffect must also be before any returns
  useEffect(() => {
    if (safeData.length > 0 && !selectedYear) {
      const initialYear = retirementYear || safeData[0]?.year || currentYear;
      setSelectedYear(initialYear);
    }
  }, [safeData, retirementYear, currentYear, selectedYear]);

  // Now we can have conditional returns after all hooks are declared
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
          <span className="ml-3 text-gray-400">Running Monte Carlo simulations...</span>
        </div>
        {loadingSeconds > 0 && (
          <div className="text-sm text-gray-500">
            Loading income data... {loadingSeconds}s
          </div>
        )}
        {loadingSeconds >= 3 && (
          <div className="text-xs text-gray-600 max-w-md text-center">
            Processing complex retirement scenarios with tax optimization and withdrawal strategies
          </div>
        )}
      </div>
    );
  }

  if (safeData.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <span className="text-gray-400">No data available. Please lock and save your optimization variables first.</span>
      </div>
    );
  }

  // Find the selected year data
  const detailYear = selectedYear ? safeData.find(d => d.year === selectedYear) : null;

  return (
    <div className="space-y-6">
      {/* Key Metrics - Exact match to deterministic tab style */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-300">Taxable Depletion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400 mb-1">
              {taxableDepletionYear || 'Never'}
            </div>
            <div className="text-xs text-gray-400">Year taxable accounts empty</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-300">First RMD Year</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400 mb-1">
              {firstRMDYear || 'N/A'}
            </div>
            <div className="text-xs text-gray-400">Required distributions begin</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-300">Lifetime Taxes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400 mb-1">
              ${Math.round(totalLifetimeTax / 1000)}K
            </div>
            <div className="text-xs text-gray-400">Total withdrawal taxes</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-300">Tax-Free Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400 mb-1">
              ${Math.round(finalTaxFreeBalance / 1000)}K
            </div>
            <div className="text-xs text-gray-400">Final Roth IRA balance</div>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Balance Projections chart intentionally removed from this tab */}

      {/* Income Sources Chart - Exact match to deterministic tab */}
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Retirement Income Sources Over Time</CardTitle>
          <p className="text-sm text-gray-400">Annual income breakdown including withdrawals</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={incomeChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="year" 
                stroke="#9CA3AF"
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="#9CA3AF"
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#ffffff'
                }}
                labelStyle={{ color: '#ffffff' }}
                itemStyle={{ color: '#ffffff' }}
                formatter={(value: any) => formatCurrency(value)}
              />
              <Legend />
              
              {/* Stack income sources like deterministic tab */}
              <Bar dataKey="workingIncome" stackId="income" fill="#10b981" name="Employment" />
              <Bar dataKey="spouseWorkingIncome" stackId="income" fill="#059669" name="Spouse Employment" />
              <Bar dataKey="socialSecurity" stackId="income" fill="#3b82f6" name="Social Security" />
              <Bar dataKey="spouseSocialSecurity" stackId="income" fill="#2563eb" name="Spouse SS" />
              <Bar dataKey="pension" stackId="income" fill="#8b5cf6" name="Pension" />
              <Bar dataKey="partTimeIncome" stackId="income" fill="#f59e0b" name="Part-Time" />
              <Bar dataKey="taxableWithdrawal" stackId="income" fill="#ef4444" name="Taxable" />
              <Bar dataKey="taxDeferredWithdrawal" stackId="income" fill="#f97316" name="401k/IRA" />
              <Bar dataKey="taxFreeWithdrawal" stackId="income" fill="#06b6d4" name="Roth" />
              <Bar dataKey="hsaWithdrawal" stackId="income" fill="#84cc16" name="HSA" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Year Details with Dropdown Selection */}
      {safeData && safeData.length > 0 && (
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">
                {detailYear ? `Year ${detailYear.year} Details (Age ${detailYear.age})` : 'Year Details'}
              </CardTitle>
              <Select 
                value={selectedYear?.toString() || ''} 
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700 text-gray-300">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 max-h-[300px] overflow-y-auto">
                  {safeData.map((item) => (
                    <SelectItem 
                      key={item.year} 
                      value={item.year.toString()}
                      className="text-gray-300 hover:bg-gray-700 focus:bg-gray-700"
                    >
                      {item.year} (Age {item.age}{item.spouseAge ? `/${item.spouseAge}` : ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {detailYear ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Income Sources */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Household Income Sources</h4>
                    <div className="space-y-2">
                      {(detailYear.workingIncome > 0 || detailYear.spouseWorkingIncome > 0) && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Employment Income</span>
                          <span className="text-sm font-medium text-green-400">
                            {formatCurrency(detailYear.workingIncome + (detailYear.spouseWorkingIncome || 0))}
                          </span>
                        </div>
                      )}
                      {(detailYear.socialSecurity > 0 || detailYear.spouseSocialSecurity > 0) && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Social Security (Combined)</span>
                          <span className="text-sm font-medium text-green-400">
                            {formatCurrency(detailYear.socialSecurity + (detailYear.spouseSocialSecurity || 0))}
                          </span>
                        </div>
                      )}
                      {(detailYear.pension > 0 || detailYear.spousePension > 0) && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Pension</span>
                          <span className="text-sm font-medium text-green-400">
                            {formatCurrency(detailYear.pension + (detailYear.spousePension || 0))}
                          </span>
                        </div>
                      )}
                      {(detailYear.partTimeIncome > 0 || detailYear.spousePartTimeIncome > 0) && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Part-Time Income</span>
                          <span className="text-sm font-medium text-green-400">
                            {formatCurrency(detailYear.partTimeIncome + (detailYear.spousePartTimeIncome || 0))}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Account Withdrawals */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Account Withdrawals</h4>
                    <div className="space-y-2">
                      {detailYear.taxableWithdrawal > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Taxable Accounts</span>
                          <span className="text-sm font-medium text-orange-400">{formatCurrency(detailYear.taxableWithdrawal)}</span>
                        </div>
                      )}
                      {detailYear.taxDeferredWithdrawal > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">401k/IRA</span>
                          <span className="text-sm font-medium text-orange-400">{formatCurrency(detailYear.taxDeferredWithdrawal)}</span>
                        </div>
                      )}
                      {detailYear.taxFreeWithdrawal > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Roth IRA</span>
                          <span className="text-sm font-medium text-orange-400">{formatCurrency(detailYear.taxFreeWithdrawal)}</span>
                        </div>
                      )}
                      {detailYear.hsaWithdrawal > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">HSA</span>
                          <span className="text-sm font-medium text-orange-400">{formatCurrency(detailYear.hsaWithdrawal)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Summary Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t border-gray-700">
                  <div className="text-center">
                    <div className="text-sm text-gray-400">Monthly Expenses</div>
                    <div className="text-lg font-semibold text-white">{formatCurrency(detailYear.monthlyExpenses)}</div>
                    <div className="text-xs text-gray-500 mt-1">Base amount*</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-400">Total Income</div>
                    <div className="text-lg font-semibold text-white">{formatCurrency(detailYear.totalIncome)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-400">Withdrawal Tax</div>
                    <div className="text-lg font-semibold text-red-400">{formatCurrency(detailYear.withdrawalTax)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-400">Success Rate</div>
                    <div className="text-lg font-semibold text-green-400">{formatPercentage(detailYear.successProbability)}</div>
                  </div>
                </div>
                
                {/* Clarification Notes */}
                <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-start space-x-2">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-gray-400 space-y-1">
                      <p>
                        <span className="text-gray-300 font-medium">*Base amount:</span> Monthly expenses shown are the base amount from your plan. 
                        The Monte Carlo simulation automatically adjusts these for inflation (~2.5% general, ~4.5% healthcare) throughout retirement.
                      </p>
                      <p>
                        <span className="text-gray-300 font-medium">Household totals:</span> All income sources shown are combined household amounts (you + spouse). 
                        Social Security includes earnings test reductions if applicable when claiming before Full Retirement Age.
                      </p>
                      <p>
                        <span className="text-gray-300 font-medium">Withdrawal strategy:</span> The simulation uses tax-efficient withdrawal ordering 
                        (HSA → Taxable → Tax-Deferred → Roth) to minimize lifetime taxes.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-400">
                Select a year from the dropdown to view details
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Account Balance Projections Table - Match deterministic tab exactly */}
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">Account Balance Projections - All Years</CardTitle>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-400">
                {safeData.length} years projection
              </div>
              <Button
                onClick={() => {
                  const planType = selectedPlan || 'optimized';
                  exportAccountBalances(safeData, planType);
                }}
                variant="outline"
                size="sm"
                className="bg-gray-800/50 hover:bg-gray-700/50 text-white border-gray-600 hover:border-gray-500"
              >
                <Download className="w-4 h-4 mr-2" />
                Export to Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-800">
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-300">YEAR</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-300">AGE</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-300">TAXABLE</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-300">TAX-DEFERRED</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-300">TAX-FREE</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-300">TOTAL (MEDIAN)</th>
                  <th className="text-right py-2 px-3 text-sm font-medium text-gray-300">SUCCESS %</th>
                </tr>
              </thead>
              <tbody>
                {safeData.map((year, index) => (
                  <tr 
                    key={year.year} 
                    className={`border-b border-gray-800 hover:bg-gray-800/50 ${
                      year.year === currentYear ? 'bg-purple-900/20' : ''
                    } ${year.failureYear ? 'bg-red-900/10' : ''}`}
                  >
                    <td className="py-2 px-3 text-sm text-gray-300">
                      {year.year}
                      {year.year === currentYear && (
                        <Badge variant="secondary" className="ml-2 text-xs">Current</Badge>
                      )}
                      {year.year === retirementYear && (
                        <Badge className="ml-2 text-xs bg-purple-600">Retire</Badge>
                      )}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-300">
                      {year.age}
                      {year.spouseAge && ` / ${year.spouseAge}`}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-300 text-right">
                      ${(year.taxableBalance / 1000).toFixed(0)}K
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-300 text-right">
                      ${(year.taxDeferredBalance / 1000).toFixed(0)}K
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-300 text-right">
                      ${(year.taxFreeBalance / 1000).toFixed(0)}K
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-300 text-right font-medium">
                      ${(year.portfolioBalance.p50 / 1000).toFixed(0)}K
                    </td>
                    <td className="py-2 px-3 text-sm text-right">
                      <span className={`font-medium ${
                        year.successProbability >= 80 ? 'text-green-400' :
                        year.successProbability >= 60 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {formatPercentage(year.successProbability)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Monte Carlo Insights */}
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Monte Carlo Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert className="bg-blue-900/20 border-blue-700">
            <Info className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-gray-300">
              <strong className="text-white">Monte Carlo Advantage:</strong> This projection accounts for market volatility, 
              sequence of returns risk, and thousands of different economic scenarios. The confidence bands show the range 
              of possible outcomes based on historical market patterns.
            </AlertDescription>
          </Alert>

          {summary && summary.probabilityOfSuccess !== undefined && (summary.probabilityOfSuccess * 100) < 80 && (
            <Alert className="bg-yellow-900/20 border-yellow-700">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-gray-300">
                <strong className="text-white">Below Target:</strong> Your {(summary.probabilityOfSuccess * 100).toFixed(1)}% 
                success rate is below the recommended 80% threshold. Consider adjusting your retirement 
                variables to improve your probability of success.
              </AlertDescription>
            </Alert>
          )}

          {safeData.some(d => d.failureYear) && (
            <Alert className="bg-red-900/20 border-red-700">
              <TrendingDown className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-gray-300">
                <strong className="text-white">Risk Years:</strong> Ages {safeData.filter(d => d.failureYear).map(d => d.age).slice(0, 5).join(', ')} 
                {safeData.filter(d => d.failureYear).length > 5 && '...'} show less than 50% probability of having funds. 
                These are critical risk points in your retirement plan.
              </AlertDescription>
            </Alert>
          )}

          {summary && summary.percentile90EndingBalance > summary.medianEndingBalance * 2 && (
            <Alert className="bg-green-900/20 border-green-700">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-gray-300">
                <strong className="text-white">High Upside Potential:</strong> In favorable markets (90th percentile), your ending 
                balance could be {(summary.percentile90EndingBalance / summary.medianEndingBalance).toFixed(1)}x 
                higher than the median scenario, providing significant legacy potential.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
