import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SequenceOfReturnsHeatmapProps {
  profile: any;
  retirementData?: any;
  scenario: {
    retirementAge: number;
    monthlyContribution: number;
    stockAllocation: number;
    inflationRate: number;
    socialSecurityAge: number;
    healthcareCosts: number;
    lifestyleAdjustment: number;
  };
  onScenarioChange?: (scenario: any) => void;
}

interface HeatmapCell {
  year: number;
  percentile: number;
  endingValue: number;
  success: boolean;
  color: string;
  returnSequence: number[];
}

export function SequenceOfReturnsHeatmap({ 
  profile, 
  retirementData, 
  scenario,
  onScenarioChange 
}: SequenceOfReturnsHeatmapProps) {
  // Interactive controls state
  const [withdrawalRate, setWithdrawalRate] = useState(4.0);
  const [retirementDuration, setRetirementDuration] = useState(30);
  const [showGuardrails, setShowGuardrails] = useState(false);

  // Helper function for normal distribution
  const generateNormalReturn = (mean: number, volatility: number): number => {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + volatility * z0;
  };

  // Generate return sequences with different orderings
  const generateReturnSequences = useCallback(() => {
    const sequences: number[][] = [];
    const numSequences = 10; // 10 percentiles from best-first to worst-first
    
    // Historical market parameters
    const stockMeanReturn = 0.10;
    const stockVolatility = 0.18;
    const bondMeanReturn = 0.05;
    const bondVolatility = 0.04;
    
    // Generate base returns for a 30-year period
    const baseReturns: number[] = [];
    for (let i = 0; i < retirementDuration; i++) {
      const stockReturn = generateNormalReturn(stockMeanReturn, stockVolatility);
      const bondReturn = generateNormalReturn(bondMeanReturn, bondVolatility);
      const portfolioReturn = (stockReturn * (scenario.stockAllocation / 100)) + 
                            (bondReturn * (1 - scenario.stockAllocation / 100));
      baseReturns.push(portfolioReturn);
    }
    
    // Sort returns to create different sequences
    const sortedReturns = [...baseReturns].sort((a, b) => b - a); // Best to worst
    const reverseSortedReturns = [...baseReturns].sort((a, b) => a - b); // Worst to best
    
    // Create sequences from best-first to worst-first
    for (let i = 0; i < numSequences; i++) {
      const sequence: number[] = [];
      const ratio = i / (numSequences - 1);
      
      // Interpolate between best-first and worst-first orderings
      for (let j = 0; j < retirementDuration; j++) {
        if (ratio === 0) {
          // Best returns first
          sequence.push(sortedReturns[j]);
        } else if (ratio === 1) {
          // Worst returns first
          sequence.push(reverseSortedReturns[j]);
        } else {
          // Mix based on percentile
          const earlyYears = Math.floor(retirementDuration * 0.3); // First 30% of retirement
          if (j < earlyYears) {
            // Early years: interpolate between best and worst
            const bestIndex = j;
            const worstIndex = j;
            const returnValue = sortedReturns[bestIndex] * (1 - ratio) + reverseSortedReturns[worstIndex] * ratio;
            sequence.push(returnValue);
          } else {
            // Later years: use shuffled returns
            sequence.push(baseReturns[(j + i * 3) % baseReturns.length]);
          }
        }
      }
      
      sequences.push(sequence);
    }
    
    return sequences;
  }, [retirementDuration, scenario.stockAllocation]);

  // Calculate portfolio outcomes for each sequence
  const calculateHeatmapData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsToShow = 10; // Show 10 years of potential retirement dates
    const heatmapData: HeatmapCell[][] = [];
    
    // Get initial portfolio value
    let initialPortfolio = 0;
    if (profile?.calculations?.retirementAssets) {
      initialPortfolio = profile.calculations.retirementAssets;
    } else if (profile?.currentRetirementBalance) {
      initialPortfolio = profile.currentRetirementBalance;
    }
    
    if (profile?.maritalStatus === 'married' && profile?.spouseCurrentRetirementBalance) {
      initialPortfolio += profile.spouseCurrentRetirementBalance;
    }
    
    const sequences = generateReturnSequences();
    
    // Calculate for each retirement year
    for (let yearOffset = 0; yearOffset < yearsToShow; yearOffset++) {
      const retirementYear = currentYear + yearOffset;
      const yearData: HeatmapCell[] = [];
      
      // Calculate for each return sequence (percentile)
      sequences.forEach((returnSequence, percentileIndex) => {
        let portfolio = initialPortfolio;
        const annualWithdrawal = portfolio * (withdrawalRate / 100);
        let failed = false;
        
        // Simulate retirement with this return sequence
        for (let year = 0; year < retirementDuration; year++) {
          // Apply returns
          portfolio *= (1 + returnSequence[year]);
          
          // Withdraw for expenses (adjusted for inflation)
          const inflationAdjustedWithdrawal = annualWithdrawal * Math.pow(1 + scenario.inflationRate / 100, year);
          portfolio -= inflationAdjustedWithdrawal;
          
          // Check for failure
          if (portfolio <= 0) {
            portfolio = 0;
            failed = true;
            break;
          }
        }
        
        // Determine color based on ending value
        let color: string;
        if (failed || portfolio <= 0) {
          color = '#dc2626'; // Red - failure
        } else if (portfolio < initialPortfolio * 0.5) {
          color = '#f59e0b'; // Orange - low balance
        } else if (portfolio < initialPortfolio) {
          color = '#eab308'; // Yellow - below initial
        } else if (portfolio < initialPortfolio * 2) {
          color = '#84cc16'; // Light green - modest growth
        } else {
          color = '#22c55e'; // Green - strong growth
        }
        
        yearData.push({
          year: retirementYear,
          percentile: (percentileIndex + 1) * 10, // 10, 20, 30... 100
          endingValue: portfolio,
          success: !failed,
          color,
          returnSequence
        });
      });
      
      heatmapData.push(yearData);
    }
    
    return heatmapData;
  }, [profile, scenario, withdrawalRate, retirementDuration, generateReturnSequences]);

  // Calculate success rate across all scenarios
  const overallSuccessRate = useMemo(() => {
    const totalCells = calculateHeatmapData.flat().length;
    const successfulCells = calculateHeatmapData.flat().filter(cell => cell.success).length;
    return (successfulCells / totalCells * 100).toFixed(1);
  }, [calculateHeatmapData]);

  return (
    <Card className="w-full bg-gray-800 border-gray-700">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
              Sequence-of-Returns Risk Heatmap
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-5 w-5 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p>This heatmap shows how the order of investment returns affects your retirement outcome. 
                    Red cells indicate portfolio depletion, while green shows success. 
                    Early negative returns can devastate a retirement plan even when long-term averages look good.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription className="text-gray-400 mt-2">
              Visualizing the impact of return timing on retirement success
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-lg px-3 py-1 text-white border-gray-600">
            {overallSuccessRate}% Success Rate
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Interactive Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-900 rounded-lg">
          <div className="space-y-2">
            <Label htmlFor="withdrawal-rate" className="text-white">
              Withdrawal Rate: {withdrawalRate}%
            </Label>
            <Slider
              id="withdrawal-rate"
              min={2}
              max={6}
              step={0.5}
              value={[withdrawalRate]}
              onValueChange={([value]) => setWithdrawalRate(value)}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="retirement-duration" className="text-white">
              Retirement Duration: {retirementDuration} years
            </Label>
            <Slider
              id="retirement-duration"
              min={20}
              max={40}
              step={5}
              value={[retirementDuration]}
              onValueChange={([value]) => setRetirementDuration(value)}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="stock-allocation" className="text-white">
              Stock Allocation: {scenario.stockAllocation}%
            </Label>
            <Slider
              id="stock-allocation"
              min={0}
              max={100}
              step={10}
              value={[scenario.stockAllocation]}
              onValueChange={([value]) => {
                if (onScenarioChange) {
                  onScenarioChange({ ...scenario, stockAllocation: value });
                }
              }}
              className="w-full"
            />
          </div>
        </div>

        {/* Key Question */}
        <div className="bg-gray-900/50 rounded-lg p-3 mb-4">
          <p className="text-white text-center">
            <span className="font-semibold">Key question answered:</span> "How vulnerable am I to bad early returns?"
          </p>
        </div>

        {/* Heatmap Visualization */}
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Y-axis labels */}
            <div className="flex">
              <div className="w-32 pr-2">
                <div className="h-8"></div> {/* Spacer for header */}
                <div className="space-y-1">
                  {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10].map(percentile => (
                    <div key={percentile} className="h-8 flex items-center justify-end">
                      <span className="text-sm text-gray-400">
                        {percentile === 100 ? 'Best First' : 
                         percentile === 10 ? 'Worst First' : 
                         `${percentile}th %ile`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Heatmap grid */}
              <div className="flex-1">
                {/* X-axis labels */}
                <div className="flex mb-2">
                  {calculateHeatmapData[0]?.map((cell, index) => (
                    <div key={index} className="flex-1 text-center">
                      <span className="text-sm text-gray-400">{cell.year}</span>
                    </div>
                  ))}
                </div>
                
                {/* Heatmap cells */}
                <div className="space-y-1">
                  {[9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(row => (
                    <div key={row} className="flex gap-1">
                      {calculateHeatmapData.map((yearData, col) => {
                        const cell = yearData[row];
                        return (
                          <TooltipProvider key={`${row}-${col}`}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="flex-1 h-8 rounded cursor-pointer transition-all hover:scale-105"
                                  style={{ backgroundColor: cell.color }}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <p className="font-semibold">
                                    Retire: {cell.year} | Sequence: {cell.percentile}th percentile
                                  </p>
                                  <p>Ending Value: ${cell.endingValue.toLocaleString()}</p>
                                  <p>Status: {cell.success ? 'Success' : 'Depleted'}</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#dc2626' }}></div>
                <span className="text-sm text-gray-400">Depleted</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
                <span className="text-sm text-gray-400">Low Balance</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#eab308' }}></div>
                <span className="text-sm text-gray-400">Below Initial</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#84cc16' }}></div>
                <span className="text-sm text-gray-400">Modest Growth</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }}></div>
                <span className="text-sm text-gray-400">Strong Growth</span>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Alert */}
        {parseFloat(overallSuccessRate) < 80 && (
          <Alert className="bg-red-900/20 border-red-800">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-gray-200">
              Your current plan shows significant sequence-of-returns risk. 
              Consider reducing your withdrawal rate or adjusting your asset allocation to improve resilience against poor early returns.
            </AlertDescription>
          </Alert>
        )}

        {/* Interpretation Guide */}
        <div className="bg-gray-900/50 rounded-lg p-4 mt-6">
          <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-300" />
            How to Interpret This Heatmap
          </h4>
          <p className="text-gray-300 text-sm leading-relaxed">
            Each cell represents a retirement scenario starting in a specific year (x-axis) with a particular sequence of returns (y-axis). 
            The color indicates your portfolio's final status: <span className="text-green-400">green</span> means success with growth, 
            <span className="text-yellow-400">yellow</span> indicates survival but with reduced wealth, and <span className="text-red-400">red</span> shows portfolio depletion. 
            The y-axis ranges from "Best First" (strong returns early in retirement) to "Worst First" (poor returns early). 
            This visualization reveals that <span className="font-semibold">when</span> you experience good or bad returns matters as much as the returns themselves—poor early returns 
            combined with withdrawals can create an unrecoverable situation even if later returns are excellent.
          </p>
        </div>
      </CardContent>
      
      <CardFooter className="border-t border-gray-700 pt-4">
        <div className="w-full text-xs text-gray-400 space-y-1">
          <p className="font-semibold text-gray-300">Assumptions & Disclosures:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Historical return model: Stocks (10% mean, 18% volatility), Bonds (5% mean, 4% volatility)</li>
            <li>Inflation rate: {scenario.inflationRate}% annually</li>
            <li>Withdrawal strategy: Fixed percentage of initial portfolio, adjusted for inflation</li>
            <li>Rebalancing: Annual to target allocation</li>
            <li>Mortality table: Not applied - assumes fixed retirement duration</li>
            <li>Tax considerations: Not included in this simplified model</li>
          </ul>
          <p className="italic mt-2 text-gray-400">
            This visualization illustrates sequence-of-returns risk for educational purposes. 
            Past performance does not guarantee future results. Consult with a qualified financial advisor for personalized advice.
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}