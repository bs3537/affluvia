import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { 
  Calculator, 
  AlertCircle, 
  TrendingDown,
  TrendingUp,
  DollarSign,
  Calendar,
  Shield,
  Info,
  Download,
  RefreshCw,
  Building
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PlanningScenarios } from './planning-scenarios';
import { EstateTaxLiability } from './estate-tax-liability';
import { EstateTaxCalculator } from './estate-tax-calculator';
import { formatCurrency } from '@/lib/utils';

interface EstateTaxLiquidityAnalysisProps {
  estatePlanId?: number;
  onUpdate?: () => void;
}

interface TaxCalculation {
  grossEstate: number;
  deductions: number;
  taxableEstate: number;
  federalExemption: number;
  federalTaxableAmount: number;
  federalTax: number;
  stateExemption: number;
  stateTaxableAmount: number;
  stateTax: number;
  totalTax: number;
  effectiveRate: number;
}

interface LiquidityAnalysis {
  liquidAssets: number;
  illiquidAssets: number;
  totalAssets: number;
  estimatedCosts: {
    estateTax: number;
    probateCosts: number;
    attorneyFees: number;
    executorFees: number;
    finalExpenses: number;
    total: number;
  };
  liquidityGap: number;
  liquidityRatio: number;
  needsLifeInsurance: boolean;
  recommendedCoverage: number;
}

export function EstateTaxLiquidityAnalysis({ estatePlanId, onUpdate = () => {} }: EstateTaxLiquidityAnalysisProps) {
  const [activeView, setActiveView] = useState<'federal' | 'state' | 'liquidity' | 'planning' | 'portability' | 'projections' | 'calculator'>('federal');
  const [yearProjection, setYearProjection] = useState(2025);
  
  // Fetch financial profile
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

  // Fetch estate plan
  const { data: estatePlan } = useQuery({
    queryKey: ['estate-plan'],
    queryFn: async () => {
      const response = await fetch('/api/estate-plan', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch estate plan');
      return response.json();
    },
  });
  
  // Calculate total liabilities
  const calculateTotalLiabilities = () => {
    if (!profile) return 0;
    const liabilities = Array.isArray(profile.liabilities) ? profile.liabilities : [];
    return liabilities.reduce((sum: number, liability: any) => sum + (liability.balance || 0), 0);
  };

  // Calculate estate value
  const calculateEstateValue = () => {
    if (!profile) return 0;
    
    const assets = Array.isArray(profile.assets) ? profile.assets : [];
    const totalAssets = assets.reduce((sum: number, asset: any) => sum + (asset.value || 0), 0);
    
    const totalLiabilities = calculateTotalLiabilities();
    
    const homeEquity = profile.primaryResidence ? 
      (profile.primaryResidence.marketValue || 0) - (profile.primaryResidence.mortgageBalance || 0) : 0;
    
    // Add life insurance death benefit if owned outside of ILIT
    const lifeInsurance = profile.lifeInsurance?.hasPolicy ? (profile.lifeInsurance.coverageAmount || 0) : 0;
    
    return totalAssets + homeEquity + lifeInsurance - totalLiabilities;
  };
  
  // Federal estate tax calculation
  const calculateFederalTax = (estateValue: number, year: number): TaxCalculation => {
    // Federal exemptions by year
    const exemptions: { [key: number]: number } = {
      2024: 13610000,
      2025: 13990000, // Estimated with inflation
      2026: 6800000,  // Post-TCJA sunset estimate
      2027: 7000000,  // Estimated with inflation
      2028: 7200000,  // Estimated with inflation
    };
    
    const federalExemption = exemptions[year] || exemptions[2026];
    const isMarried = profile?.maritalStatus === 'married';
    const totalExemption = isMarried ? federalExemption * 2 : federalExemption;
    
    // Assume standard deductions (funeral, admin, charitable)
    const deductions = estateValue * 0.05; // 5% for admin costs
    const taxableEstate = estateValue - deductions;
    
    const federalTaxableAmount = Math.max(0, taxableEstate - totalExemption);
    const federalTax = federalTaxableAmount * 0.40; // 40% federal rate
    
    // State tax calculation - 2025 rates
    const stateEstateTaxInfo: { [key: string]: { exemption: number; calculate: (taxableAmount: number) => number } } = {
      'CT': { 
        exemption: 13990000, 
        calculate: (amt) => amt * 0.12 
      },
      'HI': { 
        exemption: 5490000, 
        calculate: (amt) => {
          if (amt <= 5000000) return amt * 0.10;
          else if (amt <= 10000000) return 500000 + (amt - 5000000) * 0.15;
          else return 1250000 + (amt - 10000000) * 0.20;
        }
      },
      'IL': { 
        exemption: 4000000, 
        calculate: (amt) => {
          if (amt <= 1000000) return amt * 0.008;
          else if (amt <= 2000000) return 8000 + (amt - 1000000) * 0.10;
          else if (amt <= 3000000) return 108000 + (amt - 2000000) * 0.14;
          else return 248000 + (amt - 3000000) * 0.16;
        }
      },
      'ME': { 
        exemption: 7000000, 
        calculate: (amt) => {
          if (amt <= 3000000) return amt * 0.08;
          else if (amt <= 8000000) return 240000 + (amt - 3000000) * 0.10;
          else return 740000 + (amt - 8000000) * 0.12;
        }
      },
      'MD': { 
        exemption: 5000000, 
        calculate: (amt) => amt * 0.16 
      },
      'MA': { 
        exemption: 2000000, 
        calculate: (amt) => {
          if (amt <= 1000000) return amt * 0.008;
          else if (amt <= 2000000) return 8000 + (amt - 1000000) * 0.10;
          else if (amt <= 3000000) return 108000 + (amt - 2000000) * 0.12;
          else return 228000 + (amt - 3000000) * 0.16;
        }
      },
      'MN': { 
        exemption: 3000000, 
        calculate: (amt) => {
          if (amt <= 10000000) return amt * 0.13;
          else return 1300000 + (amt - 10000000) * 0.16;
        }
      },
      'NY': { 
        exemption: 7160000, 
        calculate: (amt) => {
          if (amt <= 1000000) return amt * 0.0306;
          else if (amt <= 2000000) return 30600 + (amt - 1000000) * 0.05;
          else if (amt <= 3000000) return 80600 + (amt - 2000000) * 0.06;
          else if (amt <= 4000000) return 140600 + (amt - 3000000) * 0.08;
          else if (amt <= 5000000) return 220600 + (amt - 4000000) * 0.10;
          else if (amt <= 10000000) return 320600 + (amt - 5000000) * 0.12;
          else return 920600 + (amt - 10000000) * 0.16;
        }
      },
      'OR': { 
        exemption: 1000000, 
        calculate: (amt) => {
          if (amt <= 500000) return amt * 0.10;
          else if (amt <= 1500000) return 50000 + (amt - 500000) * 0.11;
          else if (amt <= 2500000) return 160000 + (amt - 1500000) * 0.12;
          else if (amt <= 3500000) return 280000 + (amt - 2500000) * 0.13;
          else if (amt <= 4500000) return 410000 + (amt - 3500000) * 0.14;
          else if (amt <= 5500000) return 550000 + (amt - 4500000) * 0.15;
          else return 700000 + (amt - 5500000) * 0.16;
        }
      },
      'RI': { 
        exemption: 1802431, 
        calculate: (amt) => amt * 0.16 
      },
      'VT': { 
        exemption: 5000000, 
        calculate: (amt) => amt * 0.16 
      },
      'WA': { 
        exemption: 2193000, 
        calculate: (amt) => {
          if (amt <= 1000000) return amt * 0.10;
          else if (amt <= 2000000) return 100000 + (amt - 1000000) * 0.14;
          else if (amt <= 3000000) return 240000 + (amt - 2000000) * 0.15;
          else if (amt <= 4000000) return 390000 + (amt - 3000000) * 0.16;
          else if (amt <= 6000000) return 550000 + (amt - 4000000) * 0.18;
          else if (amt <= 7000000) return 910000 + (amt - 6000000) * 0.19;
          else return 1100000 + (amt - 7000000) * 0.20;
        }
      },
      'DC': { 
        exemption: 4873200, 
        calculate: (amt) => {
          if (amt <= 1000000) return amt * 0.112;
          else return 112000 + (amt - 1000000) * 0.16;
        }
      }
    };
    
    const stateInfo = stateEstateTaxInfo[profile?.state || ''];
    const stateExemption = stateInfo?.exemption || 0;
    const stateTaxableAmount = stateInfo ? Math.max(0, taxableEstate - stateExemption) : 0;
    const stateTax = stateInfo && stateTaxableAmount > 0 ? stateInfo.calculate(stateTaxableAmount) : 0;
    
    const totalTax = federalTax + stateTax;
    const effectiveRate = estateValue > 0 ? (totalTax / estateValue) * 100 : 0;
    
    return {
      grossEstate: estateValue,
      deductions,
      taxableEstate,
      federalExemption: totalExemption,
      federalTaxableAmount,
      federalTax,
      stateExemption,
      stateTaxableAmount,
      stateTax,
      totalTax,
      effectiveRate
    };
  };
  
  // Liquidity analysis
  const analyzeLiquidity = (): LiquidityAnalysis => {
    if (!profile) return {
      liquidAssets: 0,
      illiquidAssets: 0,
      totalAssets: 0,
      estimatedCosts: {
        estateTax: 0,
        probateCosts: 0,
        attorneyFees: 0,
        executorFees: 0,
        finalExpenses: 0,
        total: 0
      },
      liquidityGap: 0,
      liquidityRatio: 0,
      needsLifeInsurance: false,
      recommendedCoverage: 0
    };
    
    const assets = Array.isArray(profile.assets) ? profile.assets : [];
    
    // Categorize assets by liquidity
    let liquidAssets = 0;
    let illiquidAssets = 0;
    
    assets.forEach((asset: any) => {
      if (asset.type === 'cash' || asset.type === 'investment' || asset.type === 'savings') {
        liquidAssets += asset.value || 0;
      } else {
        illiquidAssets += asset.value || 0;
      }
    });
    
    // Add primary residence to illiquid
    if (profile.primaryResidence) {
      illiquidAssets += (profile.primaryResidence.marketValue || 0) - (profile.primaryResidence.mortgageBalance || 0);
    }
    
    const totalAssets = liquidAssets + illiquidAssets;
    const estateValue = calculateEstateValue();
    const taxCalc = calculateFederalTax(estateValue, yearProjection);
    
    // Estimate costs
    const estimatedCosts = {
      estateTax: taxCalc.totalTax,
      probateCosts: totalAssets * 0.03, // 3% of gross estate
      attorneyFees: totalAssets * 0.02,  // 2% of gross estate
      executorFees: totalAssets * 0.02,  // 2% of gross estate
      finalExpenses: 25000,              // Funeral, medical bills
      total: 0
    };
    
    estimatedCosts.total = Object.values(estimatedCosts).reduce((sum, cost) => sum + cost, 0);
    
    const liquidityGap = Math.max(0, estimatedCosts.total - liquidAssets);
    const liquidityRatio = estimatedCosts.total > 0 ? liquidAssets / estimatedCosts.total : 1;
    
    return {
      liquidAssets,
      illiquidAssets,
      totalAssets,
      estimatedCosts,
      liquidityGap,
      liquidityRatio,
      needsLifeInsurance: liquidityGap > 0,
      recommendedCoverage: Math.ceil(liquidityGap / 100000) * 100000 // Round up to nearest 100k
    };
  };
  
  const estateValue = calculateEstateValue();
  const taxCalculation = calculateFederalTax(estateValue, yearProjection);
  const liquidityAnalysis = analyzeLiquidity();
  
  return (
    <div className="space-y-6">
      {/* CFP Compliance Header */}
      <Alert className="bg-blue-900/20 border-blue-800">
        <Shield className="h-4 w-4 text-blue-300" />
        <AlertDescription className="text-gray-300">
          <strong>CFP Board Step 3 - Estate Tax & Liquidity Analysis:</strong> Models federal and state 
          tax exposure with 2025 TCJA sunset considerations. Liquidity stress-testing ensures sufficient 
          assets to cover taxes and expenses.
        </AlertDescription>
      </Alert>
      
      {/* Navigation - Responsive Tab System */}
      <div className="mb-6">
        {/* Desktop view - Horizontal scrollable */}
        <div className="hidden md:block overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-2">
            <Button
              variant={activeView === 'federal' ? 'default' : 'outline'}
              onClick={() => setActiveView('federal')}
              className={activeView === 'federal' ? 'bg-[#8A00C4] hover:bg-[#7000A4]' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500'}
              size="sm"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Federal Tax
            </Button>
            <Button
              variant={activeView === 'state' ? 'default' : 'outline'}
              onClick={() => setActiveView('state')}
              className={activeView === 'state' ? 'bg-[#8A00C4] hover:bg-[#7000A4]' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500'}
              size="sm"
            >
              <Building className="h-4 w-4 mr-2" />
              State Tax
            </Button>
            <Button
              variant={activeView === 'liquidity' ? 'default' : 'outline'}
              onClick={() => setActiveView('liquidity')}
              className={activeView === 'liquidity' ? 'bg-[#8A00C4] hover:bg-[#7000A4]' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500'}
              size="sm"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Liquidity Analysis
            </Button>
            <Button
              variant={activeView === 'planning' ? 'default' : 'outline'}
              onClick={() => setActiveView('planning')}
              className={activeView === 'planning' ? 'bg-[#8A00C4] hover:bg-[#7000A4]' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500'}
              size="sm"
            >
              <Shield className="h-4 w-4 mr-2" />
              Scenario Modeler
            </Button>
            <Button
              variant={activeView === 'portability' ? 'default' : 'outline'}
              onClick={() => setActiveView('portability')}
              className={activeView === 'portability' ? 'bg-[#8A00C4] hover:bg-[#7000A4]' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500'}
              size="sm"
            >
              <Shield className="h-4 w-4 mr-2" />
              Spousal Portability
            </Button>
            <Button
              variant={activeView === 'projections' ? 'default' : 'outline'}
              onClick={() => setActiveView('projections')}
              className={activeView === 'projections' ? 'bg-[#8A00C4] hover:bg-[#7000A4]' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500'}
              size="sm"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Tax Projections
            </Button>
            <Button
              variant={activeView === 'calculator' ? 'default' : 'outline'}
              onClick={() => setActiveView('calculator')}
              className={activeView === 'calculator' ? 'bg-[#8A00C4] hover:bg-[#7000A4]' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500'}
              size="sm"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Tax Calculator
            </Button>
          </div>
        </div>

        {/* Mobile view - Grid layout */}
        <div className="md:hidden grid grid-cols-2 gap-2">
          <Button
            variant={activeView === 'federal' ? 'default' : 'outline'}
            onClick={() => setActiveView('federal')}
            className={`${activeView === 'federal' ? 'bg-[#8A00C4] hover:bg-[#7000A4]' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500'} text-xs`}
            size="sm"
          >
            <Calculator className="h-3 w-3 mr-1" />
            Federal
          </Button>
          <Button
            variant={activeView === 'state' ? 'default' : 'outline'}
            onClick={() => setActiveView('state')}
            className={`${activeView === 'state' ? 'bg-[#8A00C4] hover:bg-[#7000A4]' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500'} text-xs`}
            size="sm"
          >
            <Building className="h-3 w-3 mr-1" />
            State
          </Button>
          <Button
            variant={activeView === 'liquidity' ? 'default' : 'outline'}
            onClick={() => setActiveView('liquidity')}
            className={`${activeView === 'liquidity' ? 'bg-[#8A00C4] hover:bg-[#7000A4]' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500'} text-xs`}
            size="sm"
          >
            <DollarSign className="h-3 w-3 mr-1" />
            Liquidity
          </Button>
          <Button
            variant={activeView === 'planning' ? 'default' : 'outline'}
            onClick={() => setActiveView('planning')}
            className={`${activeView === 'planning' ? 'bg-[#8A00C4] hover:bg-[#7000A4]' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500'} text-xs`}
            size="sm"
          >
            <Shield className="h-3 w-3 mr-1" />
            Scenarios
          </Button>
          <Button
            variant={activeView === 'portability' ? 'default' : 'outline'}
            onClick={() => setActiveView('portability')}
            className={`${activeView === 'portability' ? 'bg-[#8A00C4] hover:bg-[#7000A4]' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500'} text-xs`}
            size="sm"
          >
            <Shield className="h-3 w-3 mr-1" />
            Portability
          </Button>
          <Button
            variant={activeView === 'projections' ? 'default' : 'outline'}
            onClick={() => setActiveView('projections')}
            className={`${activeView === 'projections' ? 'bg-[#8A00C4] hover:bg-[#7000A4]' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500'} text-xs`}
            size="sm"
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            Projections
          </Button>
          <Button
            variant={activeView === 'calculator' ? 'default' : 'outline'}
            onClick={() => setActiveView('calculator')}
            className={`${activeView === 'calculator' ? 'bg-[#8A00C4] hover:bg-[#7000A4]' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500'} text-xs`}
            size="sm"
          >
            <Calculator className="h-3 w-3 mr-1" />
            Calculator
          </Button>
        </div>
      </div>
      
      {/* Year Projection Slider */}
      <Card className="bg-gray-700/30 border-gray-600">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white font-medium">Tax Year Projection</p>
            <Button 
              variant="default" 
              size="sm"
              className="bg-[#8A00C4] hover:bg-[#7000A4] text-white font-bold px-4 py-1"
              disabled
            >
              {yearProjection}
            </Button>
          </div>
          <Slider
            value={[yearProjection]}
            onValueChange={(value) => setYearProjection(value[0])}
            min={2024}
            max={2030}
            step={1}
            className="mt-2"
          />
          {yearProjection >= 2026 && (
            <Alert className="mt-3 bg-yellow-900/20 border-yellow-800">
              <AlertCircle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-sm text-gray-300">
                TCJA expires end of 2025. Federal exemption drops from $13.99M to ~$7M per person.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      
      {/* Federal Tax Calculation */}
      {activeView === 'federal' && (
        <div className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Federal Estate Tax Calculation ({yearProjection})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Gross Estate</span>
                      <span className="text-white font-medium">{formatCurrency(taxCalculation.grossEstate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Less: Deductions</span>
                      <span className="text-white">-{formatCurrency(taxCalculation.deductions)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-600 pt-2">
                      <span className="text-gray-400">Taxable Estate</span>
                      <span className="text-white font-medium">{formatCurrency(taxCalculation.taxableEstate)}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Federal Exemption</span>
                      <span className="text-green-400 font-medium">{formatCurrency(taxCalculation.federalExemption)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Taxable Amount</span>
                      <span className="text-white">{formatCurrency(taxCalculation.federalTaxableAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-600 pt-2">
                      <span className="text-gray-400">Federal Tax (40%)</span>
                      <span className="text-red-400 font-bold">{formatCurrency(taxCalculation.federalTax)}</span>
                    </div>
                  </div>
                </div>
                
                {taxCalculation.federalTax === 0 ? (
                  <Alert className="bg-green-900/20 border-green-800">
                    <Shield className="h-4 w-4 text-green-400" />
                    <AlertDescription className="text-gray-300">
                      No federal estate tax due. Estate value is below the exemption threshold.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-red-900/20 border-red-800">
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    <AlertDescription className="text-gray-300">
                      Federal estate tax of {formatCurrency(taxCalculation.federalTax)} will be due. 
                      Consider tax reduction strategies.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Marital Deduction Planning */}
          {profile?.maritalStatus === 'married' && (
            <Card className="bg-gray-700/30 border-gray-600">
              <CardHeader>
                <CardTitle className="text-white text-lg">Unlimited Marital Deduction</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 mb-4">
                  Assets passing to your spouse qualify for unlimited marital deduction, deferring 
                  all estate tax until the second death.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-sm text-gray-400">First Death</p>
                    <p className="text-xl font-bold text-green-400">$0 Tax</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-sm text-gray-400">Second Death</p>
                    <p className="text-xl font-bold text-yellow-400">
                      {formatCurrency(calculateFederalTax(estateValue * 2, yearProjection).federalTax)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      
      {/* State Tax Analysis */}
      {activeView === 'state' && (
        <div className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">State Estate Tax Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Define state names and info */}
              {(() => {
                const stateNames: { [key: string]: string } = {
                  'CT': 'Connecticut',
                  'HI': 'Hawaii',
                  'IL': 'Illinois',
                  'ME': 'Maine',
                  'MD': 'Maryland',
                  'MA': 'Massachusetts',
                  'MN': 'Minnesota',
                  'NY': 'New York',
                  'OR': 'Oregon',
                  'RI': 'Rhode Island',
                  'VT': 'Vermont',
                  'WA': 'Washington',
                  'DC': 'District of Columbia'
                };
                
                const stateRates: { [key: string]: string } = {
                  'CT': '12%',
                  'HI': '10-20%',
                  'IL': '0.8-16%',
                  'ME': '8-12%',
                  'MD': '0.8-16%',
                  'MA': '0.8-16%',
                  'MN': '13-16%',
                  'NY': '3.06-16%',
                  'OR': '10-16%',
                  'RI': '0.8-16%',
                  'VT': '16%',
                  'WA': '10-20%',
                  'DC': '11.2-16%'
                };
                
                const hasStateTax = ['CT', 'HI', 'IL', 'ME', 'MD', 'MA', 'MN', 'NY', 'OR', 'RI', 'VT', 'WA', 'DC'].includes(profile?.state || '');
                const stateName = stateNames[profile?.state || ''] || profile?.state;
                const stateRate = stateRates[profile?.state || ''];
                
                return hasStateTax ? (
                  <div className="space-y-4">
                    <Alert className="bg-blue-900/20 border-blue-800">
                      <Info className="h-4 w-4 text-blue-300" />
                      <AlertDescription className="text-gray-300">
                        {stateName} has a state estate tax with a {formatCurrency(taxCalculation.stateExemption)} exemption 
                        and graduated rates from {stateRate}.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Taxable Estate</span>
                          <span className="text-white font-medium">{formatCurrency(taxCalculation.taxableEstate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">{profile?.state} Exemption</span>
                          <span className="text-green-400">-{formatCurrency(taxCalculation.stateExemption)}</span>
                        </div>
                        <div className="flex justify-between border-t border-gray-600 pt-2">
                          <span className="text-gray-400">{profile?.state} Taxable Amount</span>
                          <span className="text-white font-medium">{formatCurrency(taxCalculation.stateTaxableAmount)}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">{profile?.state} Estate Tax</span>
                          <span className="text-red-400 font-bold">{formatCurrency(taxCalculation.stateTax)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Federal Tax</span>
                          <span className="text-red-400">{formatCurrency(taxCalculation.federalTax)}</span>
                        </div>
                        <div className="flex justify-between border-t border-gray-600 pt-2">
                          <span className="text-gray-400">Total Tax Burden</span>
                          <span className="text-red-400 font-bold text-xl">{formatCurrency(taxCalculation.totalTax)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* State-specific considerations */}
                    <Card className="bg-gray-700/30 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-sm text-gray-400">{stateName} Estate Tax Considerations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm text-gray-300">
                          <li>• Exemption amount: {formatCurrency(taxCalculation.stateExemption)}</li>
                          <li>• Tax rates: {stateRate}</li>
                          <li>• Consider state-specific planning strategies</li>
                          {profile?.state === 'NY' && <li>• NY has a "cliff" - estates over 105% of exemption lose entire exemption</li>}
                          {profile?.state === 'MD' && <li>• MD also has inheritance tax in addition to estate tax</li>}
                          {profile?.state === 'CT' && <li>• CT has highest state exemption, matching federal</li>}
                          {['WA', 'OR'].includes(profile?.state || '') && <li>• No state income tax but has estate tax</li>}
                        </ul>
                      </CardContent>
                    </Card>
                    
                    {taxCalculation.stateTax === 0 ? (
                      <Alert className="bg-green-900/20 border-green-800">
                        <Shield className="h-4 w-4 text-green-400" />
                        <AlertDescription className="text-gray-300">
                          No state estate tax due. Estate value is below the {profile?.state} exemption threshold.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="bg-yellow-900/20 border-yellow-800">
                        <AlertCircle className="h-4 w-4 text-yellow-400" />
                        <AlertDescription className="text-gray-300">
                          State estate tax of {formatCurrency(taxCalculation.stateTax)} will be due to {stateName}. 
                          Combined with federal tax, total burden is {formatCurrency(taxCalculation.totalTax)}.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <Alert className="bg-gray-700/30 border-gray-600">
                    <Info className="h-4 w-4 text-gray-400" />
                    <AlertDescription className="text-gray-300">
                      Your state ({profile?.state || 'Unknown'}) does not currently have a state estate tax. 
                      Only 13 states and DC impose estate taxes as of 2025.
                    </AlertDescription>
                  </Alert>
                );
              })()}
            </CardContent>
          </Card>
          
          {/* State Estate Tax Reference Table */}
          <Card className="bg-gray-700/30 border-gray-600">
            <CardHeader>
              <CardTitle className="text-white text-lg">2025 State Estate Tax Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-600">
                      <th className="text-left py-2 text-gray-400">State</th>
                      <th className="text-right py-2 text-gray-400">Exemption</th>
                      <th className="text-right py-2 text-gray-400">Top Rate</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-b border-gray-700">
                      <td className="py-2">Connecticut</td>
                      <td className="text-right">$13,990,000</td>
                      <td className="text-right">12%</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="py-2">Hawaii</td>
                      <td className="text-right">$5,490,000</td>
                      <td className="text-right">10-20%</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="py-2">Illinois</td>
                      <td className="text-right">$4,000,000</td>
                      <td className="text-right">0.8-16%</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="py-2">Maine</td>
                      <td className="text-right">$7,000,000</td>
                      <td className="text-right">8-12%</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="py-2">Maryland</td>
                      <td className="text-right">$5,000,000</td>
                      <td className="text-right">0.8-16%</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="py-2">Massachusetts</td>
                      <td className="text-right">$2,000,000</td>
                      <td className="text-right">0.8-16%</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="py-2">Minnesota</td>
                      <td className="text-right">$3,000,000</td>
                      <td className="text-right">13-16%</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="py-2">New York</td>
                      <td className="text-right">$7,160,000</td>
                      <td className="text-right">3.06-16%</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="py-2">Oregon</td>
                      <td className="text-right">$1,000,000</td>
                      <td className="text-right">10-16%</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="py-2">Rhode Island</td>
                      <td className="text-right">$1,802,431</td>
                      <td className="text-right">0.8-16%</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="py-2">Vermont</td>
                      <td className="text-right">$5,000,000</td>
                      <td className="text-right">16%</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="py-2">Washington</td>
                      <td className="text-right">$2,193,000</td>
                      <td className="text-right">10-20%</td>
                    </tr>
                    <tr>
                      <td className="py-2">District of Columbia</td>
                      <td className="text-right">$4,873,200</td>
                      <td className="text-right">11.2-16%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <Alert className="mt-4 bg-blue-900/20 border-blue-800">
                <Info className="h-4 w-4 text-blue-300" />
                <AlertDescription className="text-sm text-gray-300">
                  <strong>Note:</strong> Maryland also imposes an inheritance tax. Several states (Iowa, Kentucky, Nebraska, 
                  New Jersey, Pennsylvania) have inheritance taxes but no estate tax. Always consult with a qualified estate 
                  planning professional for the most current information.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Liquidity Analysis */}
      {activeView === 'liquidity' && (
        <div className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Estate Liquidity Stress Test</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Asset Composition */}
                <div>
                  <h4 className="text-white font-medium mb-3">Asset Composition</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-400">Liquid Assets</span>
                        <span className="text-green-400">{formatCurrency(liquidityAnalysis.liquidAssets)}</span>
                      </div>
                      <Progress 
                        value={(liquidityAnalysis.liquidAssets / liquidityAnalysis.totalAssets) * 100} 
                        className="h-2"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-400">Illiquid Assets</span>
                        <span className="text-yellow-400">{formatCurrency(liquidityAnalysis.illiquidAssets)}</span>
                      </div>
                      <Progress 
                        value={(liquidityAnalysis.illiquidAssets / liquidityAnalysis.totalAssets) * 100} 
                        className="h-2 bg-yellow-900"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Estimated Costs */}
                <div>
                  <h4 className="text-white font-medium mb-3">Estimated Settlement Costs</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Estate Taxes</span>
                      <span className="text-red-400">{formatCurrency(liquidityAnalysis.estimatedCosts.estateTax)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Probate Costs (3%)</span>
                      <span className="text-red-400">{formatCurrency(liquidityAnalysis.estimatedCosts.probateCosts)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Attorney Fees (2%)</span>
                      <span className="text-red-400">{formatCurrency(liquidityAnalysis.estimatedCosts.attorneyFees)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Executor Fees (2%)</span>
                      <span className="text-red-400">{formatCurrency(liquidityAnalysis.estimatedCosts.executorFees)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Final Expenses</span>
                      <span className="text-red-400">{formatCurrency(liquidityAnalysis.estimatedCosts.finalExpenses)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-gray-600 pt-2">
                      <span className="text-white">Total Costs</span>
                      <span className="text-red-400">{formatCurrency(liquidityAnalysis.estimatedCosts.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Liquidity Analysis Results */}
              <div className="mt-6">
                {liquidityAnalysis.liquidityGap > 0 ? (
                  <Alert className="bg-red-900/20 border-red-800">
                    <TrendingDown className="h-4 w-4 text-red-400" />
                    <AlertDescription className="text-gray-300">
                      <strong>Liquidity Shortfall:</strong> {formatCurrency(liquidityAnalysis.liquidityGap)} gap 
                      between liquid assets and settlement costs. Estate may need to sell illiquid assets or 
                      consider life insurance.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-green-900/20 border-green-800">
                    <Shield className="h-4 w-4 text-green-400" />
                    <AlertDescription className="text-gray-300">
                      <strong>Adequate Liquidity:</strong> Liquid assets exceed estimated settlement costs 
                      by {formatCurrency(liquidityAnalysis.liquidAssets - liquidityAnalysis.estimatedCosts.total)}.
                    </AlertDescription>
                  </Alert>
                )}
                
                {liquidityAnalysis.needsLifeInsurance && (
                  <Card className="mt-4 bg-gray-700/30 border-gray-600">
                    <CardHeader>
                      <CardTitle className="text-white text-lg">Life Insurance Solution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-300 mb-3">
                        Consider survivorship life insurance to cover liquidity gap:
                      </p>
                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Recommended Coverage</span>
                          <span className="text-2xl font-bold text-primary">
                            {formatCurrency(liquidityAnalysis.recommendedCoverage)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Scenario Modeler */}
      {activeView === 'planning' && profile && (
        <PlanningScenarios 
          profile={{
            id: profile.id || 'default',
            userId: profile.userId || '',
            totalAssets: calculateEstateValue() + calculateTotalLiabilities(),
            totalLiabilities: calculateTotalLiabilities(),
            netWorth: calculateEstateValue(),
            spouseDetails: profile.spouse ? {
              firstName: profile.spouse.firstName,
              lastName: profile.spouse.lastName,
              dateOfBirth: profile.spouse.dateOfBirth,
            } : undefined,
            maritalStatus: profile.maritalStatus || 'single',
            state: profile.state || 'CA',
          }} 
          onUpdate={onUpdate} 
        />
      )}
      
      {/* Spousal Portability Section */}
      {activeView === 'portability' && (
        <div className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Spousal Portability (DSUE) Optimizer</CardTitle>
            </CardHeader>
            <CardContent>
              {profile?.maritalStatus === 'married' ? (
                <div className="space-y-4">
                  <Alert className="bg-blue-900/20 border-blue-800">
                    <Info className="h-4 w-4 text-blue-300" />
                    <AlertDescription className="text-gray-300">
                      The Deceased Spousal Unused Exclusion (DSUE) allows a surviving spouse to use 
                      their deceased spouse's unused federal estate tax exemption. This effectively 
                      doubles the exemption to $27.22M (2024) or ~$14M (post-2025).
                    </AlertDescription>
                  </Alert>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-gray-700/30 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-lg text-white">First Spouse to Die</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-gray-400">Federal Exemption ({yearProjection})</p>
                            <p className="text-xl font-bold text-white">
                              {formatCurrency(taxCalculation.federalExemption / (profile?.maritalStatus === 'married' ? 2 : 1))}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">Estimated Estate Value</p>
                            <p className="text-xl font-bold text-white">
                              {formatCurrency(estateValue / 2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">Unused Exemption (DSUE)</p>
                            <p className="text-xl font-bold text-green-400">
                              {formatCurrency(Math.max(0, taxCalculation.federalExemption / 2 - estateValue / 2))}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gray-700/30 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-lg text-white">Surviving Spouse</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-gray-400">Own Exemption</p>
                            <p className="text-xl font-bold text-white">
                              {formatCurrency(taxCalculation.federalExemption / 2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">Plus DSUE Amount</p>
                            <p className="text-xl font-bold text-green-400">
                              +{formatCurrency(Math.max(0, taxCalculation.federalExemption / 2 - estateValue / 2))}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">Total Available Exemption</p>
                            <p className="text-xl font-bold text-primary">
                              {formatCurrency(taxCalculation.federalExemption / 2 + Math.max(0, taxCalculation.federalExemption / 2 - estateValue / 2))}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Tax Impact Analysis */}
                  <Card className="bg-gray-700/30 border-gray-600">
                    <CardHeader>
                      <CardTitle className="text-lg text-white">Tax Impact Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-400 mb-2">Without Portability</p>
                          <div className="bg-gray-800/50 rounded-lg p-3">
                            <p className="text-sm text-gray-300">Surviving spouse exemption only</p>
                            <p className="text-lg font-bold text-red-400">
                              Tax: {formatCurrency(Math.max(0, (estateValue - taxCalculation.federalExemption / 2) * 0.4))}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400 mb-2">With Portability Election</p>
                          <div className="bg-gray-800/50 rounded-lg p-3">
                            <p className="text-sm text-gray-300">Using DSUE amount</p>
                            <p className="text-lg font-bold text-green-400">
                              Tax: {formatCurrency(taxCalculation.federalTax)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-green-900/20 rounded-lg border border-green-800">
                        <p className="text-sm text-green-400 font-medium">
                          Potential Tax Savings: {formatCurrency(Math.max(0, (estateValue - taxCalculation.federalExemption / 2) * 0.4 - taxCalculation.federalTax))}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Alert className="bg-yellow-900/20 border-yellow-800">
                    <AlertCircle className="h-4 w-4 text-yellow-400" />
                    <AlertDescription className="text-gray-300">
                      <strong>Important Filing Requirements:</strong>
                      <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                        <li>File Form 706 within 9 months of first spouse's death (15 months with extension)</li>
                        <li>Must elect portability on the return - it's not automatic</li>
                        <li>Filing required even if no estate tax is owed</li>
                        <li>Consider state estate tax implications - portability is federal only</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                  
                  {/* Portability vs. Credit Shelter Trust */}
                  <Card className="bg-gray-700/30 border-gray-600">
                    <CardHeader>
                      <CardTitle className="text-lg text-white">Portability vs. Credit Shelter Trust</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-gray-800/50 rounded-lg p-4">
                            <h4 className="text-white font-medium mb-2">Portability Advantages</h4>
                            <ul className="text-sm text-gray-300 space-y-1">
                              <li>✓ Simplicity - no trust needed</li>
                              <li>✓ Step-up in basis at second death</li>
                              <li>✓ Flexibility for surviving spouse</li>
                              <li>✓ Lower administration costs</li>
                            </ul>
                          </div>
                          <div className="bg-gray-800/50 rounded-lg p-4">
                            <h4 className="text-white font-medium mb-2">Credit Shelter Trust Advantages</h4>
                            <ul className="text-sm text-gray-300 space-y-1">
                              <li>✓ Asset protection from creditors</li>
                              <li>✓ Protection from remarriage</li>
                              <li>✓ State estate tax benefits</li>
                              <li>✓ GST tax planning opportunities</li>
                            </ul>
                          </div>
                        </div>
                        <Alert className="bg-blue-900/20 border-blue-800">
                          <Info className="h-4 w-4 text-blue-300" />
                          <AlertDescription className="text-sm text-gray-300">
                            Consider a hybrid approach: Use portability for federal tax and a state-only QTIP for state estate tax in high-tax states.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Alert className="bg-gray-700/30 border-gray-600">
                  <Info className="h-4 w-4 text-gray-400" />
                  <AlertDescription className="text-gray-300">
                    Spousal portability (DSUE) is only available for married couples. 
                    This feature allows the surviving spouse to use their deceased spouse's 
                    unused federal estate tax exemption.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tax Projections View */}
      {activeView === 'projections' && (
        <div className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Estate Tax Projections</CardTitle>
            </CardHeader>
            <CardContent>
              <EstateTaxLiability estatePlanId={estatePlanId} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tax Calculator View */}
      {activeView === 'calculator' && (
        <div className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Interactive Estate Tax Calculator</CardTitle>
            </CardHeader>
            <CardContent>
              <EstateTaxCalculator estatePlan={estatePlan} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}