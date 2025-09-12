import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Calculator, 
  DollarSign,
  TrendingDown,
  Info,
  AlertCircle,
  Building,
  Users,
  Gift,
  Home
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';

interface EstateTaxCalculatorProps {
  estatePlan?: any;
}

export function EstateTaxCalculator({ estatePlan }: EstateTaxCalculatorProps) {
  const currentYear = new Date().getFullYear();
  
  // Fetch financial profile to get user's state
  const { data: profile } = useQuery({
    queryKey: ['/api/financial-profile'],
    queryFn: async () => {
      const response = await fetch('/api/financial-profile', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    },
  });
  
  // 2025 Federal estate tax exemption
  const federalExemptionSingle = 13990000; // Updated for 2025
  const federalExemptionMarried = federalExemptionSingle * 2; // $27.98 million for married couples
  const federalTaxRate = 0.40;
  
  // State exemptions (2024-2025 values)
  const stateExemptions: Record<string, { exemption: number; rate: number; label: string }> = {
    'None': { exemption: 0, rate: 0, label: 'No State Estate Tax' },
    'CT': { exemption: 13610000, rate: 0.12, label: 'Connecticut' },
    'DC': { exemption: 4254800, rate: 0.16, label: 'District of Columbia' },
    'HI': { exemption: 5490000, rate: 0.20, label: 'Hawaii' },
    'IL': { exemption: 4000000, rate: 0.16, label: 'Illinois' },
    'ME': { exemption: 5800000, rate: 0.12, label: 'Maine' },
    'MD': { exemption: 5000000, rate: 0.16, label: 'Maryland' },
    'MA': { exemption: 2000000, rate: 0.16, label: 'Massachusetts' }, // $2M exemption, only amounts over $2M are taxed
    'MN': { exemption: 3000000, rate: 0.16, label: 'Minnesota' },
    'NY': { exemption: 6580000, rate: 0.16, label: 'New York' },
    'OR': { exemption: 1000000, rate: 0.16, label: 'Oregon' },
    'RI': { exemption: 1733264, rate: 0.16, label: 'Rhode Island' },
    'VT': { exemption: 5000000, rate: 0.16, label: 'Vermont' },
    'WA': { exemption: 2193000, rate: 0.20, label: 'Washington' }
  };
  
  // Helper function to get default state from profile
  const getDefaultState = () => {
    if (profile?.state) {
      // Check if the profile state is in our list of states with estate tax
      const upperState = profile.state.toUpperCase();
      if (stateExemptions[upperState]) {
        return upperState;
      }
    }
    return 'None';
  };

  const [inputs, setInputs] = useState({
    grossEstate: estatePlan?.totalEstateValue || 5000000,
    deductions: 0,
    lifeInsurance: 0,
    gifts: 0,
    maritalStatus: profile?.maritalStatus === 'single' ? 'single' : 'married',
    state: getDefaultState(),
    charitableGifts: 0,
    annualGifting: 0,
    yearsOfGifting: 5
  });

  const [results, setResults] = useState({
    taxableEstate: 0,
    federalTax: 0,
    stateTax: 0,
    totalTax: 0,
    netToHeirs: 0,
    effectiveRate: 0,
    savingsFromStrategies: 0
  });

  // Update state when profile loads
  useEffect(() => {
    if (profile) {
      setInputs(prev => ({
        ...prev,
        maritalStatus: profile.maritalStatus === 'single' ? 'single' : 'married',
        state: getDefaultState()
      }));
    }
  }, [profile]);
  
  // Calculate taxes whenever inputs change
  useEffect(() => {
    calculateTaxes();
  }, [inputs]);

  const calculateTaxes = () => {
    // Calculate gross estate
    const totalEstate = parseFloat(inputs.grossEstate.toString()) + 
                       parseFloat(inputs.lifeInsurance.toString()) + 
                       parseFloat(inputs.gifts.toString());
    
    // Deductions
    const totalDeductions = parseFloat(inputs.deductions.toString()) + 
                           parseFloat(inputs.charitableGifts.toString());
    
    // Annual gifting reduction
    const annualGiftingReduction = parseFloat(inputs.annualGifting.toString()) * 
                                  parseFloat(inputs.yearsOfGifting.toString()) * 
                                  (inputs.maritalStatus === 'married' ? 2 : 1);
    
    const taxableEstate = Math.max(0, totalEstate - totalDeductions - annualGiftingReduction);
    
    // Federal tax calculation
    const federalExemption = inputs.maritalStatus === 'married' ? federalExemptionMarried : federalExemptionSingle;
    const federalTaxableAmount = Math.max(0, taxableEstate - federalExemption);
    const federalTax = federalTaxableAmount * federalTaxRate;
    
    // State tax calculation
    const stateInfo = stateExemptions[inputs.state];
    const stateTaxableAmount = Math.max(0, taxableEstate - stateInfo.exemption);
    const stateTax = stateTaxableAmount * stateInfo.rate;
    
    // Total results
    const totalTax = federalTax + stateTax;
    const netToHeirs = taxableEstate - totalTax;
    const effectiveRate = taxableEstate > 0 ? (totalTax / taxableEstate) * 100 : 0;
    
    // Calculate savings from strategies
    const baselineTax = (totalEstate - parseFloat(inputs.deductions.toString())) > federalExemption ? 
      ((totalEstate - parseFloat(inputs.deductions.toString()) - federalExemption) * federalTaxRate) : 0;
    const savingsFromStrategies = Math.max(0, baselineTax - totalTax);
    
    setResults({
      taxableEstate,
      federalTax,
      stateTax,
      totalTax,
      netToHeirs,
      effectiveRate,
      savingsFromStrategies
    });
  };

  // Data for visualization
  const taxBreakdownData = [
    { name: 'Federal Tax', amount: results.federalTax, fill: '#EF4444' },
    { name: 'State Tax', amount: results.stateTax, fill: '#F59E0B' },
    { name: 'Net to Heirs', amount: results.netToHeirs, fill: '#10B981' }
  ];

  const strategies = [
    {
      icon: Gift,
      title: 'Annual Gift Tax Exclusion',
      description: `Gift up to $19,000 per recipient per year (2025)`,
      impact: `Current strategy saves: ${formatCurrency(inputs.annualGifting * inputs.yearsOfGifting * (inputs.maritalStatus === 'married' ? 2 : 1))}`
    },
    {
      icon: Users,
      title: 'Charitable Giving',
      description: 'Reduce estate size with charitable donations',
      impact: `Current deduction: ${formatCurrency(inputs.charitableGifts)}`
    },
    {
      icon: Building,
      title: 'Irrevocable Life Insurance Trust',
      description: 'Remove life insurance from taxable estate',
      impact: inputs.lifeInsurance > 0 ? `Could save: ${formatCurrency(inputs.lifeInsurance * 0.4)}` : 'Not currently utilized'
    },
    {
      icon: Home,
      title: 'Qualified Personal Residence Trust',
      description: 'Transfer residence at reduced gift value',
      impact: 'Potential 20-40% valuation discount'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Calculator Inputs */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Estate Tax Calculator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Gross Estate */}
            <div>
              <Label htmlFor="grossEstate" className="text-white">
                Gross Estate Value
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="grossEstate"
                  type="number"
                  value={inputs.grossEstate}
                  onChange={(e) => setInputs({ ...inputs, grossEstate: parseFloat(e.target.value) || 0 })}
                  className="bg-gray-700 border-gray-600 text-white pl-10"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Marital Status */}
            <div>
              <Label htmlFor="maritalStatus" className="text-white">
                Marital Status
              </Label>
              <Select
                value={inputs.maritalStatus}
                onValueChange={(value) => setInputs({ ...inputs, maritalStatus: value })}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="married">Married</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* State */}
            <div>
              <Label htmlFor="state" className="text-white">
                State of Residence
                {profile?.state && (
                  <span className="text-xs text-gray-400 ml-2">
                    (Auto-selected from profile)
                  </span>
                )}
              </Label>
              <Select
                value={inputs.state}
                onValueChange={(value) => setInputs({ ...inputs, state: value })}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(stateExemptions).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      {info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Life Insurance */}
            <div>
              <Label htmlFor="lifeInsurance" className="text-white">
                Life Insurance (Outside Trust)
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="lifeInsurance"
                  type="number"
                  value={inputs.lifeInsurance}
                  onChange={(e) => setInputs({ ...inputs, lifeInsurance: parseFloat(e.target.value) || 0 })}
                  className="bg-gray-700 border-gray-600 text-white pl-10"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Charitable Gifts */}
            <div>
              <Label htmlFor="charitableGifts" className="text-white">
                Charitable Gifts
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="charitableGifts"
                  type="number"
                  value={inputs.charitableGifts}
                  onChange={(e) => setInputs({ ...inputs, charitableGifts: parseFloat(e.target.value) || 0 })}
                  className="bg-gray-700 border-gray-600 text-white pl-10"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Annual Gifting */}
            <div>
              <Label htmlFor="annualGifting" className="text-white">
                Annual Gifting Amount
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="annualGifting"
                  type="number"
                  value={inputs.annualGifting}
                  onChange={(e) => setInputs({ ...inputs, annualGifting: parseFloat(e.target.value) || 0 })}
                  className="bg-gray-700 border-gray-600 text-white pl-10"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Years of Gifting Slider */}
          <div>
            <Label htmlFor="yearsOfGifting" className="text-white">
              Years of Annual Gifting: {inputs.yearsOfGifting}
            </Label>
            <Slider
              id="yearsOfGifting"
              min={0}
              max={20}
              step={1}
              value={[inputs.yearsOfGifting]}
              onValueChange={([value]) => setInputs({ ...inputs, yearsOfGifting: value })}
              className="mt-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-700/30 border-gray-600">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">Taxable Estate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(results.taxableEstate)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-700/30 border-gray-600">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">Total Estate Tax</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-400">
              {formatCurrency(results.totalTax)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {results.effectiveRate.toFixed(1)}% effective rate
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-700/30 border-gray-600">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">Net to Heirs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-400">
              {formatCurrency(results.netToHeirs)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-700/30 border-gray-600">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">Tax Savings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-300">
              {formatCurrency(results.savingsFromStrategies)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              From strategies
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tax Breakdown Chart */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Estate Distribution Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taxBreakdownData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                <Tooltip 
                  formatter={(value: any) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                />
                <Bar dataKey="amount" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tax Details */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Tax Calculation Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Federal Tax */}
            <div className="flex justify-between items-center py-2 border-b border-gray-700">
              <div>
                <p className="text-gray-400">Federal Estate Tax</p>
                <p className="text-xs text-gray-500">
                  Exemption: {formatCurrency(inputs.maritalStatus === 'married' ? federalExemptionMarried : federalExemptionSingle)}
                </p>
              </div>
              <p className="text-white font-semibold">{formatCurrency(results.federalTax)}</p>
            </div>

            {/* State Tax */}
            <div className="flex justify-between items-center py-2 border-b border-gray-700">
              <div>
                <p className="text-gray-400">State Estate Tax ({stateExemptions[inputs.state].label})</p>
                <p className="text-xs text-gray-500">
                  Exemption: {formatCurrency(stateExemptions[inputs.state].exemption)}
                </p>
              </div>
              <p className="text-white font-semibold">{formatCurrency(results.stateTax)}</p>
            </div>

            {/* Total Tax */}
            <div className="flex justify-between items-center py-2">
              <p className="text-white font-semibold">Total Estate Tax</p>
              <p className="text-red-400 font-bold text-xl">{formatCurrency(results.totalTax)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax Reduction Strategies */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-green-400" />
            Tax Reduction Strategies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strategies.map((strategy, index) => {
              const Icon = strategy.icon;
              return (
                <div key={index} className="bg-gray-700/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 text-primary mt-1" />
                    <div className="flex-1">
                      <h4 className="text-white font-medium">{strategy.title}</h4>
                      <p className="text-gray-400 text-sm mt-1">{strategy.description}</p>
                      <p className="text-green-400 text-sm mt-2">{strategy.impact}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <Alert className="bg-yellow-900/20 border-yellow-800">
        <AlertCircle className="h-4 w-4 text-yellow-400" />
        <AlertDescription className="text-gray-300">
          This calculator provides estimates based on 2025 federal estate tax exemptions ($13.99M single, $27.98M married) 
          and current state tax laws. State estate taxes only apply to amounts exceeding the state exemption threshold. 
          For example, Massachusetts taxes only the amount over $2M, not the entire estate. 
          Tax laws change frequently - consult with qualified estate planning and tax professionals for accurate planning.
        </AlertDescription>
      </Alert>
    </div>
  );
}