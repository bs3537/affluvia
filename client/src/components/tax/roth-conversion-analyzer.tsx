import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, TrendingUp, DollarSign, Calculator, AlertCircle } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ComposedChart
} from 'recharts';

interface RothConversionAnalyzerProps {
  profile: any;
  onConversionStrategyChange?: (strategy: RothConversionStrategy) => void;
}

interface RothConversionStrategy {
  annualConversionAmount: number;
  yearsToConvert: number;
  targetBracket: string;
  estimatedTotalTaxCost: number;
  lifetimeTaxSavings: number;
  breakEvenYear: number;
}

interface ConversionYear {
  year: number;
  age: number;
  conversionAmount: number;
  taxCost: number;
  marginalRate: number;
  taxableIncome: number;
  remainingTaxDeferred: number;
  rothBalance: number;
  cumulativeTaxPaid: number;
  cumulativeSavings: number;
}

export function RothConversionAnalyzer({ profile, onConversionStrategyChange }: RothConversionAnalyzerProps) {
  const [conversionAmount, setConversionAmount] = useState(0);
  const [yearsToConvert, setYearsToConvert] = useState(5);
  const [targetBracket, setTargetBracket] = useState('12%');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [projectionYears, setProjectionYears] = useState<ConversionYear[]>([]);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [strategy, setStrategy] = useState<RothConversionStrategy | null>(null);

  // Calculate current tax situation
  const currentAge = profile.userAge || 45;
  const retirementAge = profile.retirementAge || 65;
  const taxDeferredBalance = profile.taxDeferredRetirementAccounts || 0;
  const rothBalance = profile.taxFreeRetirementAccounts || 0;
  const currentIncome = profile.userAnnualIncome || 0;
  const filingStatus = profile.maritalStatus === 'married' ? 'married' : 'single';
  
  // 2024 tax brackets
  const taxBrackets = filingStatus === 'married' ? {
    '10%': 23200,
    '12%': 94300,
    '22%': 201050,
    '24%': 383900,
    '32%': 487450,
    '35%': 731200,
    '37%': Infinity
  } : {
    '10%': 11600,
    '12%': 47150,
    '22%': 100525,
    '24%': 191950,
    '32%': 243725,
    '35%': 609350,
    '37%': Infinity
  };

  // Calculate optimal conversion amount based on target bracket
  useEffect(() => {
    const calculateOptimalConversion = () => {
      // After retirement, estimate taxable income
      const ssIncome = currentAge >= 67 ? (profile.userSocialSecurityBenefit || 0) * 12 : 0;
      const pensionIncome = currentAge >= retirementAge ? (profile.pensionBenefit || 0) * 12 : 0;
      const estimatedTaxableIncome = ssIncome * 0.85 + pensionIncome; // 85% of SS is taxable
      
      const bracketLimit = taxBrackets[targetBracket as keyof typeof taxBrackets];
      const roomInBracket = Math.max(0, bracketLimit - estimatedTaxableIncome);
      
      // Suggest conversion amount to fill bracket
      const suggestedAmount = Math.min(
        roomInBracket,
        taxDeferredBalance / yearsToConvert,
        taxDeferredBalance * 0.2 // Don't convert more than 20% per year
      );
      
      setConversionAmount(Math.round(suggestedAmount / 1000) * 1000); // Round to nearest $1000
    };

    calculateOptimalConversion();
  }, [targetBracket, yearsToConvert, profile]);

  // Calculate projections
  useEffect(() => {
    if (conversionAmount <= 0) return;

    const years: ConversionYear[] = [];
    let remainingTaxDeferred = taxDeferredBalance;
    let currentRothBalance = rothBalance;
    let cumulativeTaxPaid = 0;
    let cumulativeSavings = 0;

    for (let i = 0; i < 30; i++) {
      const year = new Date().getFullYear() + i;
      const age = currentAge + i;
      const isRetired = age >= retirementAge;
      
      // Determine if we should convert this year
      const shouldConvert = i < yearsToConvert && remainingTaxDeferred > 0 && age < 73;
      const actualConversion = shouldConvert ? Math.min(conversionAmount, remainingTaxDeferred) : 0;
      
      // Estimate taxable income for the year
      let taxableIncome = 0;
      if (!isRetired) {
        taxableIncome = currentIncome;
      } else {
        const ssIncome = age >= 67 ? (profile.userSocialSecurityBenefit || 0) * 12 : 0;
        const pensionIncome = (profile.pensionBenefit || 0) * 12;
        const rmdAmount = age >= 73 ? remainingTaxDeferred / (90 - age) : 0; // Simplified RMD
        taxableIncome = ssIncome * 0.85 + pensionIncome + rmdAmount;
      }
      
      // Add conversion to taxable income
      const totalTaxableIncome = taxableIncome + actualConversion;
      
      // Calculate marginal rate
      let marginalRate = 0.10;
      for (const [bracket, limit] of Object.entries(taxBrackets)) {
        if (totalTaxableIncome > limit) {
          marginalRate = parseFloat(bracket) / 100;
        } else {
          break;
        }
      }
      
      // Calculate tax on conversion (simplified)
      const taxCost = actualConversion * marginalRate;
      
      // Update balances
      if (actualConversion > 0) {
        remainingTaxDeferred -= actualConversion;
        currentRothBalance += (actualConversion - taxCost);
        cumulativeTaxPaid += taxCost;
      }
      
      // Calculate savings (difference between future RMD taxes and current conversion taxes)
      if (age >= 73) {
        const rmdAmount = remainingTaxDeferred / (90 - age);
        const rmdTax = rmdAmount * 0.22; // Assume 22% rate on RMDs
        const rothWithdrawal = currentRothBalance * 0.04; // 4% withdrawal rate, tax-free
        const taxSavings = rmdTax * 0.5; // Conservative estimate of savings
        cumulativeSavings += taxSavings;
      }
      
      // Apply growth (7% nominal)
      remainingTaxDeferred *= 1.07;
      currentRothBalance *= 1.07;
      
      years.push({
        year,
        age,
        conversionAmount: actualConversion,
        taxCost,
        marginalRate,
        taxableIncome: totalTaxableIncome,
        remainingTaxDeferred,
        rothBalance: currentRothBalance,
        cumulativeTaxPaid,
        cumulativeSavings
      });
    }

    setProjectionYears(years);

    // Calculate comparison data (with vs without conversions)
    const withConversions = years.map(y => ({
      age: y.age,
      taxDeferred: y.remainingTaxDeferred,
      roth: y.rothBalance,
      totalValue: y.remainingTaxDeferred + y.rothBalance,
      taxPaid: y.cumulativeTaxPaid
    }));

    const withoutConversions = years.map((y, i) => {
      const growthFactor = Math.pow(1.07, i);
      return {
        age: y.age,
        taxDeferred: taxDeferredBalance * growthFactor,
        roth: rothBalance * growthFactor,
        totalValue: (taxDeferredBalance + rothBalance) * growthFactor,
        taxPaid: 0
      };
    });

    setComparisonData(
      years.map((y, i) => ({
        age: y.age,
        withConversion: withConversions[i].totalValue,
        withoutConversion: withoutConversions[i].totalValue,
        difference: withConversions[i].totalValue - withoutConversions[i].totalValue,
        rothWithConversion: withConversions[i].roth,
        rothWithoutConversion: withoutConversions[i].roth
      }))
    );

    // Calculate strategy summary
    const totalTaxCost = years.reduce((sum, y) => sum + y.taxCost, 0);
    const lifetimeSavings = cumulativeSavings;
    const breakEvenYear = years.findIndex(y => y.cumulativeSavings > y.cumulativeTaxPaid);
    
    const newStrategy: RothConversionStrategy = {
      annualConversionAmount: conversionAmount,
      yearsToConvert,
      targetBracket,
      estimatedTotalTaxCost: totalTaxCost,
      lifetimeTaxSavings: lifetimeSavings,
      breakEvenYear: breakEvenYear > 0 ? currentAge + breakEvenYear : currentAge + 20
    };
    
    setStrategy(newStrategy);
    onConversionStrategyChange?.(newStrategy);
  }, [conversionAmount, yearsToConvert, targetBracket, profile]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Roth Conversion Analyzer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Roth conversions can reduce lifetime taxes by strategically moving money from tax-deferred 
              accounts to tax-free Roth accounts during low-income years. This is especially powerful 
              between retirement and age 73 when RMDs begin.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Conversion Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Conversion Strategy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Annual Conversion Amount: {formatCurrency(conversionAmount)}
            </label>
            <Slider
              value={[conversionAmount]}
              onValueChange={([value]) => setConversionAmount(value)}
              min={0}
              max={Math.min(200000, taxDeferredBalance)}
              step={5000}
              className="mb-2"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>$0</span>
              <span>{formatCurrency(Math.min(200000, taxDeferredBalance))}</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Years to Convert: {yearsToConvert}
            </label>
            <Slider
              value={[yearsToConvert]}
              onValueChange={([value]) => setYearsToConvert(value)}
              min={1}
              max={Math.min(20, 73 - currentAge)}
              step={1}
              className="mb-2"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1 year</span>
              <span>{Math.min(20, 73 - currentAge)} years</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Target Tax Bracket</label>
            <div className="grid grid-cols-3 gap-2">
              {['10%', '12%', '22%', '24%'].map((bracket) => (
                <Button
                  key={bracket}
                  variant={targetBracket === bracket ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTargetBracket(bracket)}
                >
                  {bracket} Bracket
                  <br />
                  <span className="text-xs">
                    Up to {formatCurrency(taxBrackets[bracket as keyof typeof taxBrackets])}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Summary */}
      {strategy && (
        <Card>
          <CardHeader>
            <CardTitle>Conversion Impact Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(strategy.annualConversionAmount)}
                </p>
                <p className="text-sm text-gray-600">Annual Conversion</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(strategy.estimatedTotalTaxCost)}
                </p>
                <p className="text-sm text-gray-600">Total Tax Cost</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(strategy.lifetimeTaxSavings)}
                </p>
                <p className="text-sm text-gray-600">Lifetime Tax Savings</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  Age {strategy.breakEvenYear}
                </p>
                <p className="text-sm text-gray-600">Break-Even Age</p>
              </div>
            </div>

            {strategy.lifetimeTaxSavings > strategy.estimatedTotalTaxCost && (
              <Alert className="bg-green-50 border-green-200">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  This conversion strategy could save you {formatCurrency(strategy.lifetimeTaxSavings - strategy.estimatedTotalTaxCost)} in 
                  lifetime taxes. The strategy becomes profitable at age {strategy.breakEvenYear}.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Projection Charts */}
      <Card>
        <CardHeader>
          <CardTitle>Account Balance Projections</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={projectionYears.slice(0, 30)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="age" />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => `Age ${label}`}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="remainingTaxDeferred"
                stackId="1"
                stroke="#ef4444"
                fill="#ef4444"
                name="Tax-Deferred (401k/IRA)"
              />
              <Area
                type="monotone"
                dataKey="rothBalance"
                stackId="1"
                stroke="#10b981"
                fill="#10b981"
                name="Tax-Free (Roth)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tax Impact Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Annual Tax Impact</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={projectionYears.slice(0, yearsToConvert + 5)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="age" />
              <YAxis yAxisId="left" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => formatPercent(value)} />
              <Tooltip 
                formatter={(value: any, name: string) => {
                  if (name === 'Marginal Tax Rate') return formatPercent(value);
                  return formatCurrency(value);
                }}
                labelFormatter={(label) => `Age ${label}`}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="conversionAmount" fill="#3b82f6" name="Conversion Amount" />
              <Bar yAxisId="left" dataKey="taxCost" fill="#ef4444" name="Tax Cost" />
              <Line yAxisId="right" type="monotone" dataKey="marginalRate" stroke="#8b5cf6" name="Marginal Tax Rate" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Strategy Comparison: With vs Without Conversions</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={comparisonData.slice(0, 30)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="age" />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => `Age ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="withConversion"
                stroke="#10b981"
                name="With Conversions (After-Tax Value)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="withoutConversion"
                stroke="#ef4444"
                name="Without Conversions"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <Button
            variant="ghost"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full justify-between"
          >
            <span>Advanced Settings</span>
            <span>{showAdvanced ? '−' : '+'}</span>
          </Button>
        </CardHeader>
        {showAdvanced && (
          <CardContent>
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                These settings allow fine-tuning of conversion assumptions. Default values are based on 
                common scenarios and tax-efficient strategies.
              </AlertDescription>
            </Alert>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Growth Rate Assumption</label>
                <p className="text-xs text-gray-500 mb-2">Currently using 7% annual growth</p>
              </div>
              <div>
                <label className="text-sm font-medium">RMD Tax Rate Assumption</label>
                <p className="text-xs text-gray-500 mb-2">Currently assuming 22% on future RMDs</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Key Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Key Insights & Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {conversionAmount > 0 && (
              <>
                <div className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
                  <p className="text-sm">
                    Converting {formatCurrency(conversionAmount)} annually for {yearsToConvert} years will move {' '}
                    {formatCurrency(Math.min(conversionAmount * yearsToConvert, taxDeferredBalance))} to tax-free Roth accounts.
                  </p>
                </div>
                {currentAge < retirementAge && (
                  <div className="flex items-start gap-2">
                    <div className="h-2 w-2 rounded-full bg-yellow-500 mt-1.5" />
                    <p className="text-sm">
                      Consider waiting until retirement (age {retirementAge}) when your income and tax rate will be lower.
                    </p>
                  </div>
                )}
                {strategy && strategy.breakEvenYear < 75 && (
                  <div className="flex items-start gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5" />
                    <p className="text-sm">
                      Your break-even age of {strategy.breakEvenYear} suggests this strategy will likely be profitable 
                      given typical life expectancies.
                    </p>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-500 mt-1.5" />
                  <p className="text-sm">
                    Roth conversions are most effective when filling up to the {targetBracket} tax bracket, 
                    maximizing the use of lower tax rates before RMDs force higher rates.
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}