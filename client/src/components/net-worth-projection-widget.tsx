import React, { useState, useEffect, useMemo } from 'react';
import { hash32 } from '@/workers/rng';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ChevronDown, TrendingUp, RefreshCw, Info, X } from 'lucide-react';

/**
 * Net Worth Projection Widget with Calculation Methodology Info
 * 
 * Features:
 * - Displays projected net worth combining retirement assets + real estate
 * - Uses saved projections data when available for performance
 * - Falls back to real-time Monte Carlo + real estate calculations
 * - Info icon shows detailed calculation methodology modal
 * - Methodology explains data sources, assumptions, and update triggers
 * 
 * Added: Info modal with comprehensive calculation details for users/advisors
 */
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface NetWorthProjectionWidgetProps {
  isExpanded: boolean;
  onToggle: () => void;
  monteCarloData?: any;
  profile?: any;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(0)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

const formatCurrencyWithDecimal = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

export function NetWorthProjectionWidget({
  isExpanded,
  onToggle,
  monteCarloData,
  profile
}: NetWorthProjectionWidgetProps) {
  const [simulationData, setSimulationData] = useState<any>(null);
  const [projectionData, setProjectionData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRetirementStepButton, setShowRetirementStepButton] = useState(false);

  const fetchSimulationData = async () => {
    setIsLoading(true);
    setLoadingSeconds(0); // Reset timer
    setErrorMessage(null);
    setShowRetirementStepButton(false);
    
    try {
      const response = await fetch('/api/calculate-retirement-monte-carlo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          skipCache: true, // Always calculate fresh for dashboard widget
          seed: seedFromParams(undefined, 'net-worth-projection')
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setSimulationData(result);
      } else if (response.status === 400) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.message?.includes('Step 11') || errorData.message?.includes('retirement')) {
          setErrorMessage('Complete retirement planning (Step 11) to view projections');
          setShowRetirementStepButton(true);
        } else {
          setErrorMessage('Unable to calculate projections. Please complete all required intake steps.');
        }
      } else {
        setErrorMessage('Failed to load projection data. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching simulation data:', error);
      setErrorMessage('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToRetirementStep = () => {
    // Navigate to intake form Step 11 (retirement planning)
    const event = new CustomEvent('navigateToIntakeSection', {
      detail: { sectionType: 'retirement', step: 11 }
    });
    window.dispatchEvent(event);
  };

  // FIXED: Always fetch fresh Monte Carlo data for consistent calculations
  useEffect(() => {
    console.log('NetWorthProjectionWidget: ALWAYS fetching fresh Monte Carlo data for consistency');
    console.log('NetWorthProjectionWidget: Ignoring cached projections and saved data to prevent inconsistencies');
    
    // Always fetch fresh data to ensure consistency after server restarts
    fetchSimulationData();
  }, []); // Only run once when component mounts, no dependency on cached data

  // Re-fetch when dashboard triggers a global refresh
  useEffect(() => {
    const handler = () => {
      fetchSimulationData();
    };
    window.addEventListener('refreshDashboard', handler);
    return () => window.removeEventListener('refreshDashboard', handler);
  }, []);

  // Timer for loading state
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading) {
      timer = setInterval(() => {
        setLoadingSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLoading]);

  // Close modal with ESC key and handle focus
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showMethodology) {
        setShowMethodology(false);
      }
    };

    if (showMethodology) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = 'unset';
      };
    }
  }, [showMethodology]);

  // Calculate real estate equity and projections - ALWAYS use fresh Monte Carlo data
  const { projectionDataResult, netWorthAtRetirement, netWorthAtLongevity, currentAge, retirementAge, longevityAge } = useMemo(() => {
    console.log('NetWorthProjectionWidget: Calculating projections from Monte Carlo (supports client/server)');
    const nominalRealEstateGrowthRate = 0.043; // 4.3% annual growth (historical average)

    const hasServerResults = simulationData && (simulationData as any).results && (simulationData as any).results.length > 0;
    const hasClientPath = simulationData && (simulationData as any).yearlyCashFlows && (simulationData as any).yearlyCashFlows.length > 0;

    if (!hasServerResults && !hasClientPath) {
      return {
        projectionDataResult: [],
        netWorthAtRetirement: 0,
        netWorthAtLongevity: 0,
        currentAge: 50,
        retirementAge: 65,
        longevityAge: 93
      };
    }

    // Get current real estate VALUES (not equity - we'll subtract mortgage separately)
    const homeValue = profile?.primaryResidence?.marketValue || 0;
    
    // Get additional properties value
    const additionalPropertiesValue = (profile?.assets || [])
      .filter((asset: any) => asset.type === 'real-estate')
      .reduce((sum: number, asset: any) => sum + (asset.value || 0), 0);
    
    const totalRealEstateValue = homeValue + additionalPropertiesValue;

    // Calculate mortgage/debt reduction over time
    const totalMortgageBalance = (profile?.primaryResidence?.mortgageBalance || 0) + 
      ((profile?.liabilities || [])
        .filter((liability: any) => liability.type === 'mortgage')
        .reduce((sum: number, liability: any) => sum + (liability.balance || 0), 0));
    
    const monthlyMortgagePayment = (profile?.primaryResidence?.monthlyPayment || 0) +
      ((profile?.liabilities || [])
        .filter((liability: any) => liability.type === 'mortgage')
        .reduce((sum: number, liability: any) => sum + (liability.monthlyPayment || 0), 0));

    // Debug logging for real estate calculations
    console.log('NetWorthProjectionWidget - Fresh Real Estate Calculation:', {
      homeValue: homeValue?.toLocaleString() || '0',
      additionalPropertiesValue: additionalPropertiesValue?.toLocaleString() || '0',
      totalRealEstateValue: totalRealEstateValue?.toLocaleString() || '0',
      totalMortgageBalance: totalMortgageBalance?.toLocaleString() || '0',
      monthlyMortgagePayment: monthlyMortgagePayment?.toLocaleString() || '0',
      nominalGrowthRate: (nominalRealEstateGrowthRate * 100).toFixed(1) + '%'
    });

    let medianPath: any[] = [];
    let currentAgeDetected = 50;
    let retirementAgeDetected = (simulationData as any).retirementAge || 65;
    const longevityAge = 93;
    if (hasServerResults) {
      const trials = (simulationData as any).results;
      const firstTrial = trials[0];
      currentAgeDetected = firstTrial.yearlyData?.[0]?.age || 50;
      medianPath = firstTrial.yearlyData;
    } else if (hasClientPath) {
      medianPath = (simulationData as any).yearlyCashFlows;
      currentAgeDetected = profile?.currentAge || currentAgeDetected;
    }

    // Build a map of age -> retirement assets from the median path
    const ageMedians: Record<number, number> = {};
    medianPath.forEach((entry, idx) => {
      const age = entry.age || (currentAgeDetected + idx);
      const value = entry.portfolioBalance ?? entry.portfolioValue ?? 0;
      ageMedians[age] = value;
    });

    console.log('NetWorthProjectionWidget: Calculated Monte Carlo medians for', Object.keys(ageMedians).length, 'ages');
    console.log('NetWorthProjectionWidget: Sample medians at key ages:', {
      currentAge: ageMedians[currentAgeDetected]?.toLocaleString() || 'N/A',
      retirementAge: ageMedians[retirementAgeDetected]?.toLocaleString() || 'N/A', 
      longevityAge: ageMedians[longevityAge]?.toLocaleString() || 'N/A'
    });

    // Create projection data with real estate growth
    const currentYear = new Date().getFullYear();
    
    // Debug logging for mortgage calculations
    console.log('NetWorthProjectionWidget - Mortgage Debug:', {
      totalMortgageBalance,
      monthlyMortgagePayment,
      currentAge: currentAgeDetected,
      retirementAge: retirementAgeDetected,
      longevityAge
    });
    
    const projectionDataCalc = Object.keys(ageMedians)
      .map(ageStr => parseInt(ageStr))
      .sort((a, b) => a - b)
      .map(age => {
        const yearsFromNow = age - currentAgeDetected;
        const year = currentYear + yearsFromNow;
        
        // Calculate real estate value with 4.3% nominal growth on FULL VALUE
        const realEstateValue = totalRealEstateValue * Math.pow(1 + nominalRealEstateGrowthRate, yearsFromNow);
        
        // Calculate remaining mortgage balance (simplified linear reduction)
        const monthsFromNow = yearsFromNow * 12;
        // Improved mortgage reduction calculation: assume 40% of payment goes to principal
        const remainingMortgage = Math.max(0, totalMortgageBalance - (monthlyMortgagePayment * monthsFromNow * 0.4));
        
        // Net real estate value (projected value minus remaining mortgage)
        const netRealEstate = Math.max(0, realEstateValue - remainingMortgage);
        
        // Retirement assets (median from Monte Carlo)
        const retirementAssets = ageMedians[age] || 0;
        
        // Total net worth
        const totalNetWorth = retirementAssets + netRealEstate;
        
        // Debug logging for specific ages
        if (age === 92 || age === 93) {
          console.log(`NetWorthProjectionWidget - Age ${age} Debug:`, {
            yearsFromNow,
            realEstateValue: realEstateValue.toFixed(0),
            remainingMortgage: remainingMortgage.toFixed(0),
            netRealEstate: netRealEstate.toFixed(0),
            retirementAssets: retirementAssets.toFixed(0),
            totalNetWorth: totalNetWorth.toFixed(0)
          });
        }
        
        return {
          year,
          age,
          retirementAssets,
          realEstate: netRealEstate,
          debt: remainingMortgage,
          totalNetWorth
        };
      });

    // Find net worth at key ages
    const retirementData = projectionDataCalc.find(d => d.age === retirementAgeDetected) || projectionDataCalc[0];
    const longevityData = projectionDataCalc.find(d => d.age === longevityAge) || projectionDataCalc[projectionDataCalc.length - 1];
    
    return {
      projectionDataResult: projectionDataCalc,
      netWorthAtRetirement: retirementData?.totalNetWorth || 0,
      netWorthAtLongevity: longevityData?.totalNetWorth || 0,
      currentAge: currentAgeDetected,
      retirementAge: retirementAgeDetected,
      longevityAge
    };
  }, [simulationData, profile]); // Removed projectionData dependency to force fresh calculations

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = projectionDataResult.find(d => d.year === label);
      if (!dataPoint) return null;
      
      return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl">
          <p className="text-white font-semibold mb-2">Age {dataPoint.age} ({label})</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-gray-400">Total Net Worth:</span>
              <span className="text-white font-medium">{formatCurrency(dataPoint.totalNetWorth)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-green-400">Retirement Assets:</span>
              <span className="text-white font-medium">{formatCurrency(dataPoint.retirementAssets)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-cyan-400">Real Estate:</span>
              <span className="text-white font-medium">{formatCurrency(dataPoint.realEstate)}</span>
            </div>
            {dataPoint.debt > 0 && (
              <div className="flex justify-between gap-3">
                <span className="text-red-400">Debt:</span>
                <span className="text-white font-medium">-{formatCurrency(dataPoint.debt)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="card-gradient border-gray-700 widget-card bg-gradient-to-br from-gray-900/40 to-gray-800/40 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            Projected Net Worth
            <Button
              onClick={() => setShowMethodology(true)}
              size="sm"
              variant="ghost"
              className="text-gray-400 hover:text-white h-6 w-6 p-0"
              title="View calculation methodology"
            >
              <Info className="w-4 h-4" />
            </Button>
          </CardTitle>
        </div>
        <div className="flex gap-2">
          {projectionDataResult.length > 0 && !isLoading && (
            <Button
              onClick={fetchSimulationData}
              size="sm"
              variant="ghost"
              className="text-gray-400 hover:text-white h-8 w-8 p-0"
              title="Refresh projection"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="text-gray-400 mt-2 text-sm">Loading projection data...</p>
            <p className="text-gray-500 mt-1 text-xs">
              {loadingSeconds > 0 && `${loadingSeconds}s`}
            </p>
          </div>
        ) : projectionDataResult.length > 0 ? (
          <>
            {/* Key Metrics */}
            <div className="mb-6 flex justify-between items-start">
              <div>
                <p className="text-gray-400 text-sm">At retirement ({retirementAge})</p>
                <p className="text-3xl font-bold text-white">{formatCurrencyWithDecimal(netWorthAtRetirement)}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm">At longevity (93)</p>
                <p className="text-3xl font-bold text-white">{formatCurrencyWithDecimal(netWorthAtLongevity)}</p>
              </div>
            </div>

            {/* Stacked Area Chart */}
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={projectionDataResult} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
                <defs>
                  <linearGradient id="colorRetirement" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.3}/>
                  </linearGradient>
                  <linearGradient id="colorRealEstate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.3}/>
                  </linearGradient>
                  <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.3} />
                <XAxis 
                  dataKey="year"
                  stroke="#9CA3AF"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                  minTickGap={30}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  tick={{ fontSize: 10 }}
                  tickFormatter={formatCurrency}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 'dataMax']}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {/* Debt (negative area) */}
                {projectionDataResult.some(d => d.debt > 0) && (
                  <Area
                    type="monotone"
                    dataKey={(dataPoint) => -dataPoint.debt}
                    stackId="1"
                    stroke="#EF4444"
                    fill="url(#colorDebt)"
                    name="Debt"
                  />
                )}
                
                {/* Retirement Assets */}
                <Area
                  type="monotone"
                  dataKey="retirementAssets"
                  stackId="2"
                  stroke="#10B981"
                  fill="url(#colorRetirement)"
                  name="Savings"
                />
                
                {/* Real Estate */}
                <Area
                  type="monotone"
                  dataKey="realEstate"
                  stackId="2"
                  stroke="#06B6D4"
                  fill="url(#colorRealEstate)"
                  name="Real Estate"
                />
                
                {/* Reference lines */}
                <ReferenceLine 
                  x={projectionDataResult.find(d => d.age === retirementAge)?.year}
                  stroke="#B040FF" 
                  strokeDasharray="5 5"
                  strokeOpacity={0.5}
                />
                <ReferenceLine 
                  x={projectionDataResult.find(d => d.age === longevityAge)?.year}
                  stroke="#F59E0B" 
                  strokeDasharray="5 5"
                  strokeOpacity={0.5}
                />
                
                {/* Zero line */}
                <ReferenceLine y={0} stroke="#6B7280" strokeOpacity={0.5} />
              </AreaChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-xs text-gray-400">Savings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-cyan-500 rounded"></div>
                <span className="text-xs text-gray-400">Real Estate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span className="text-xs text-gray-400">Other Assets</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span className="text-xs text-gray-400">Debt</span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            {errorMessage ? (
              <>
                <p className="text-red-300 mb-2">{errorMessage}</p>
                {showRetirementStepButton ? (
                  <div className="space-y-2">
                    <Button 
                      onClick={navigateToRetirementStep}
                      className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white mr-2"
                    >
                      Go to Retirement Step
                    </Button>
                    <Button 
                      onClick={fetchSimulationData} 
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-800"
                      disabled={isLoading}
                    >
                      Try Again
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={fetchSimulationData} 
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                    disabled={isLoading}
                  >
                    Try Again
                  </Button>
                )}
              </>
            ) : (
              <>
                <p className="text-gray-300 mb-2">No projection data available</p>
                <p className="text-gray-400 text-sm mb-4">Click below to calculate your net worth projection</p>
                <Button 
                  onClick={fetchSimulationData} 
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                  disabled={isLoading}
                >
                  Calculate Projection
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>

      {/* Calculation Methodology Modal */}
      {showMethodology && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowMethodology(false)}
        >
          <div 
            className="bg-gray-900 border border-gray-700 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h3 className="text-xl font-semibold text-white">Net Worth Projection Methodology</h3>
              <Button
                onClick={() => setShowMethodology(false)}
                size="sm"
                variant="ghost"
                className="text-gray-400 hover:text-white h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Overview */}
              <div>
                <h4 className="text-lg font-medium text-white mb-3">Overview</h4>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Net Worth Projections combine retirement asset growth (from Monte Carlo simulation) with real estate appreciation and debt reduction to show your complete financial picture over time.
                </p>
              </div>

              {/* Components */}
              <div>
                <h4 className="text-lg font-medium text-white mb-3">Components</h4>
                <div className="space-y-4">
                  
                  <div className="bg-gray-800/50 p-4 rounded-lg">
                    <h5 className="text-green-400 font-medium mb-2">🟢 Retirement Assets</h5>
                    <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
                      <li>Uses median (50th percentile) from Monte Carlo simulation</li>
                      <li>Includes 401(k), IRA, and other retirement accounts</li>
                      <li>Accounts for market volatility and sequence of returns</li>
                      <li>Based on your risk profile and asset allocation</li>
                    </ul>
                  </div>

                  <div className="bg-gray-800/50 p-4 rounded-lg">
                    <h5 className="text-cyan-400 font-medium mb-2">🟦 Real Estate</h5>
                    <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
                      <li>Home value grows at <strong>4.3% annually</strong> (historical average)</li>
                      <li>Projections based on full property value, not just equity</li>
                      <li>Includes primary residence and additional properties</li>
                      <li>Mortgage balance reduces over time with payments</li>
                    </ul>
                  </div>

                  <div className="bg-gray-800/50 p-4 rounded-lg">
                    <h5 className="text-red-400 font-medium mb-2">🟥 Debt Reduction</h5>
                    <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
                      <li>Mortgage balances decrease based on payment schedule</li>
                      <li>Assumes ~40% of mortgage payment goes to principal</li>
                      <li>Other debts reduce according to their payment terms</li>
                      <li>Net real estate = Property Value - Remaining Mortgage</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Data Sources */}
              <div>
                <h4 className="text-lg font-medium text-white mb-3">Data Sources</h4>
                <div className="bg-gray-800/30 p-4 rounded-lg">
                  <ul className="text-gray-300 text-sm space-y-2">
                    <li>✅ <strong>Plaid Connected Accounts:</strong> Real-time balance and transaction data</li>
                    <li>✅ <strong>Manual Account Entries:</strong> Accounts you've added through the intake form</li>
                    <li>✅ <strong>Property Information:</strong> Home value, mortgage details from intake form</li>
                    <li>✅ <strong>Investment Profile:</strong> Risk tolerance and asset allocation preferences</li>
                  </ul>
                </div>
              </div>

              {/* Assumptions */}
              <div>
                <h4 className="text-lg font-medium text-white mb-3">Key Assumptions</h4>
                <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-lg">
                  <ul className="text-amber-100 text-sm space-y-1 list-disc list-inside">
                    <li>Real estate appreciates at 4.3% annually (inflation-adjusted)</li>
                    <li>Retirement projections use nominal (inflation-included) returns</li>
                    <li>Mortgage payments remain constant over loan term</li>
                    <li>No major economic disruptions or policy changes</li>
                  </ul>
                </div>
              </div>

              {/* Updates */}
              <div>
                <h4 className="text-lg font-medium text-white mb-3">When Projections Update</h4>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-green-400 text-sm">🔄</span>
                    <span className="text-gray-300 text-sm">When you resubmit the intake form with changes</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-400 text-sm">🔄</span>
                    <span className="text-gray-300 text-sm">When Plaid syncs fresh account data automatically</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400 text-sm">🔄</span>
                    <span className="text-gray-300 text-sm">When you click the refresh button manually</span>
                  </div>
                </div>
              </div>

              <div className="text-center pt-4 border-t border-gray-700">
                <p className="text-gray-400 text-xs">
                  Projections are estimates based on current data and historical trends. 
                  Actual results may vary due to market conditions and personal circumstances.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
