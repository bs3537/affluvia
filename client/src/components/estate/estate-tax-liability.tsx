import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DollarSign, 
  TrendingUp, 
  Calculator,
  AlertCircle,
  Info,
  Shield,
  Users,
  Home,
  Briefcase,
  PiggyBank,
  ChevronRight,
  Heart
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/utils';

interface EstateTaxLiabilityProps {
  estatePlanId?: number;
}

interface TaxCalculation {
  grossEstate: number;
  deductions: number;
  taxableEstate: number;
  federalExemption: number;
  stateExemption: number;
  federalTaxableAmount: number;
  stateTaxableAmount: number;
  federalTax: number;
  stateTax: number;
  totalTax: number;
  effectiveRate: number;
  marginalRate: number;
}

export function EstateTaxLiability({ estatePlanId }: EstateTaxLiabilityProps) {
  const [scenarioYear, setScenarioYear] = useState(2024);
  const [estateGrowthRate, setEstateGrowthRate] = useState(3);
  const [showStrategies, setShowStrategies] = useState(false);
  
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
  
  const isMarried = profile?.maritalStatus === 'married';
  const spouseName = profile?.spouseName || 'Spouse';
  const userName = profile ? `${profile.firstName} ${profile.lastName}` : 'User';
  
  // Calculate estate values
  const calculateEstateValues = () => {
    if (!profile) return null;
    
    const assets = Array.isArray(profile.assets) ? profile.assets : [];
    const liabilities = Array.isArray(profile.liabilities) ? profile.liabilities : [];
    
    // Calculate current values
    const liquidAssets = assets
      .filter((a: any) => ['savings', 'checking', 'money_market', 'cd'].includes(a.type))
      .reduce((sum: number, a: any) => sum + (a.value || 0), 0);
    
    const investments = assets
      .filter((a: any) => ['stocks', 'bonds', 'mutual_funds', 'etf'].includes(a.type))
      .reduce((sum: number, a: any) => sum + (a.value || 0), 0);
    
    const retirementAccounts = assets
      .filter((a: any) => a.type === 'retirement')
      .reduce((sum: number, a: any) => sum + (a.value || 0), 0);
    
    const realEstate = profile.primaryResidence ? 
      (profile.primaryResidence.marketValue || 0) : 0;
    
    const businessInterests = assets
      .filter((a: any) => a.type === 'business')
      .reduce((sum: number, a: any) => sum + (a.value || 0), 0);
    
    const personalProperty = assets
      .filter((a: any) => a.type === 'personal')
      .reduce((sum: number, a: any) => sum + (a.value || 0), 0);
    
    const totalLiabilities = liabilities.reduce((sum: number, l: any) => sum + (l.balance || 0), 0);
    const mortgageBalance = profile.primaryResidence?.mortgageBalance || 0;
    
    const grossEstate = liquidAssets + investments + retirementAccounts + realEstate + businessInterests + personalProperty;
    const netEstate = grossEstate - totalLiabilities - mortgageBalance;
    
    // Apply growth rate for future projection
    const yearsToProject = scenarioYear - 2024;
    const growthFactor = Math.pow(1 + estateGrowthRate / 100, yearsToProject);
    const projectedGrossEstate = grossEstate * growthFactor;
    const projectedNetEstate = netEstate * growthFactor;
    
    return {
      current: {
        liquidAssets,
        investments,
        retirementAccounts,
        realEstate,
        businessInterests,
        personalProperty,
        totalLiabilities,
        mortgageBalance,
        grossEstate,
        netEstate
      },
      projected: {
        grossEstate: projectedGrossEstate,
        netEstate: projectedNetEstate
      }
    };
  };
  
  const estateValues = calculateEstateValues();
  
  // Calculate tax liability
  const calculateTaxLiability = (estateValue: number, year: number): { user: TaxCalculation; spouse?: TaxCalculation; combined: TaxCalculation } | null => {
    if (!estateValues) return null;
    
    // Federal exemptions by year (adjusted for inflation)
    const federalExemptions: { [key: number]: number } = {
      2024: 13610000,
      2025: 13990000, // estimated
      2026: 7000000,  // current law sunset
      2027: 7175000,  // estimated with inflation
      2028: 7354000,
      2029: 7538000,
      2030: 7726000
    };
    
    // State exemptions (example for NY)
    const stateExemption = profile?.state === 'NY' ? 6940000 : 0;
    
    const federalExemption = federalExemptions[year] || federalExemptions[2024];
    
    const calculateIndividualTax = (individualEstate: number): TaxCalculation => {
      // Deductions (funeral expenses, administrative costs, charitable bequests)
      const deductions = individualEstate * 0.05; // Assume 5% for deductions
      const taxableEstate = individualEstate - deductions;
      
      // Federal tax calculation
      const federalTaxableAmount = Math.max(0, taxableEstate - federalExemption);
      const federalTax = federalTaxableAmount * 0.40; // 40% federal estate tax rate
      
      // State tax calculation
      const stateTaxableAmount = Math.max(0, taxableEstate - stateExemption);
      let stateTax = 0;
      
      // NY estate tax is graduated
      if (profile?.state === 'NY' && stateTaxableAmount > 0) {
        if (stateTaxableAmount <= 500000) {
          stateTax = stateTaxableAmount * 0.035;
        } else if (stateTaxableAmount <= 1000000) {
          stateTax = 17500 + (stateTaxableAmount - 500000) * 0.045;
        } else if (stateTaxableAmount <= 2000000) {
          stateTax = 40000 + (stateTaxableAmount - 1000000) * 0.055;
        } else {
          stateTax = 95000 + (stateTaxableAmount - 2000000) * 0.16;
        }
      }
      
      const totalTax = federalTax + stateTax;
      const effectiveRate = (totalTax / individualEstate) * 100;
      const marginalRate = federalTaxableAmount > 0 ? 40 : 0;
      
      return {
        grossEstate: individualEstate,
        deductions,
        taxableEstate,
        federalExemption,
        stateExemption,
        federalTaxableAmount,
        stateTaxableAmount,
        federalTax,
        stateTax,
        totalTax,
        effectiveRate,
        marginalRate
      };
    };
    
    if (!isMarried) {
      const userCalc = calculateIndividualTax(estateValue);
      return { user: userCalc, combined: userCalc };
    }
    
    // For married couples, calculate separate estates
    const userEstate = estateValue * 0.5; // Simplified 50/50 split
    const spouseEstate = estateValue * 0.5;
    
    const userCalc = calculateIndividualTax(userEstate);
    const spouseCalc = calculateIndividualTax(spouseEstate);
    
    // Combined calculation (if both die in same year)
    const combinedCalc = calculateIndividualTax(estateValue);
    
    return { user: userCalc, spouse: spouseCalc, combined: combinedCalc };
  };
  
  const currentTaxCalc = estateValues ? calculateTaxLiability(estateValues.current.netEstate, 2024) : null;
  const projectedTaxCalc = estateValues ? calculateTaxLiability(estateValues.projected.netEstate, scenarioYear) : null;
  
  if (!profile || !estateValues) {
    return <div className="text-center py-8 text-gray-400">Loading estate data...</div>;
  }
  
  return (
    <div className="space-y-6">
      {/* Disclaimer */}
      <Alert className="bg-yellow-900/20 border-yellow-800">
        <AlertCircle className="h-4 w-4 text-yellow-400" />
        <AlertTitle className="text-yellow-100">Tax Calculation Notice</AlertTitle>
        <AlertDescription className="text-gray-300">
          These calculations are estimates based on current federal and state tax laws. Tax laws change frequently, 
          and your actual tax liability may differ. The federal estate tax exemption is scheduled to sunset in 2026, 
          potentially reducing from $13.61M to approximately $7M per person. Consult with a tax professional for 
          personalized advice.
        </AlertDescription>
      </Alert>
      
      {/* Estate Composition */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-primary" />
            Current Estate Composition
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Liquid Assets</span>
              <span className="text-white">{formatCurrency(estateValues.current.liquidAssets)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Investments</span>
              <span className="text-white">{formatCurrency(estateValues.current.investments)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Retirement Accounts</span>
              <span className="text-white">{formatCurrency(estateValues.current.retirementAccounts)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Real Estate</span>
              <span className="text-white">{formatCurrency(estateValues.current.realEstate)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Business Interests</span>
              <span className="text-white">{formatCurrency(estateValues.current.businessInterests)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Personal Property</span>
              <span className="text-white">{formatCurrency(estateValues.current.personalProperty)}</span>
            </div>
            <div className="border-t border-gray-600 pt-3">
              <div className="flex justify-between items-center font-semibold">
                <span className="text-white">Gross Estate</span>
                <span className="text-white">{formatCurrency(estateValues.current.grossEstate)}</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-2">
                <span className="text-gray-400">Less: Liabilities & Mortgage</span>
                <span className="text-red-400">-{formatCurrency(estateValues.current.totalLiabilities + estateValues.current.mortgageBalance)}</span>
              </div>
              <div className="flex justify-between items-center font-semibold mt-2">
                <span className="text-white">Net Estate</span>
                <span className="text-green-400">{formatCurrency(estateValues.current.netEstate)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Tax Projection Controls */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Estate Tax Projections
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="scenarioYear" className="text-white">
              Projection Year: {scenarioYear}
            </Label>
            <Slider
              id="scenarioYear"
              min={2024}
              max={2030}
              step={1}
              value={[scenarioYear]}
              onValueChange={([value]) => setScenarioYear(value)}
              className="mt-2"
            />
            <p className="text-xs text-gray-400 mt-1">
              Note: Federal exemption sunsets in 2026, dropping from $13.61M to ~$7M
            </p>
          </div>
          
          <div>
            <Label htmlFor="growthRate" className="text-white">
              Annual Estate Growth Rate: {estateGrowthRate}%
            </Label>
            <Slider
              id="growthRate"
              min={0}
              max={10}
              step={0.5}
              value={[estateGrowthRate]}
              onValueChange={([value]) => setEstateGrowthRate(value)}
              className="mt-2"
            />
          </div>
          
          <div className="bg-gray-700/30 rounded-lg p-4">
            <p className="text-sm text-gray-400">Projected Estate Value in {scenarioYear}:</p>
            <p className="text-2xl font-bold text-white mt-1">
              {formatCurrency(estateValues.projected.netEstate)}
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Current vs Projected Tax Liability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Tax Liability */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-lg">Current Tax Liability (2024)</CardTitle>
          </CardHeader>
          <CardContent>
            {currentTaxCalc && (
              <div className="space-y-4">
                {!isMarried ? (
                  <TaxBreakdown calculation={currentTaxCalc.user} />
                ) : (
                  <>
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-400">First Death Scenario</h4>
                      <p className="text-xs text-gray-500">
                        With unlimited marital deduction, no tax due on first death
                      </p>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-400">Second Death Scenario</h4>
                      <TaxBreakdown calculation={currentTaxCalc.combined} compact />
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Projected Tax Liability */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-lg">Projected Tax Liability ({scenarioYear})</CardTitle>
          </CardHeader>
          <CardContent>
            {projectedTaxCalc && (
              <div className="space-y-4">
                {!isMarried ? (
                  <TaxBreakdown calculation={projectedTaxCalc.user} />
                ) : (
                  <>
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-400">First Death Scenario</h4>
                      <p className="text-xs text-gray-500">
                        With unlimited marital deduction, no tax due on first death
                      </p>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-400">Second Death Scenario</h4>
                      <TaxBreakdown calculation={projectedTaxCalc.combined} compact />
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Tax Minimization Strategies */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Tax Minimization Strategies
            </CardTitle>
            <Button
              variant="outline"
              onClick={() => setShowStrategies(!showStrategies)}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              {showStrategies ? 'Hide' : 'Show'} Strategies
            </Button>
          </div>
        </CardHeader>
        {showStrategies && (
          <CardContent>
            <div className="space-y-4">
              {isMarried && (
                <StrategyCard
                  title="Portability Election"
                  description="Preserve unused federal exemption from first spouse's death for use by surviving spouse"
                  savings={`Up to ${formatCurrency(13610000 * 0.4)} in tax savings`}
                  icon={<Users className="h-5 w-5 text-blue-300" />}
                />
              )}
              
              <StrategyCard
                title="Grantor Retained Annuity Trust (GRAT)"
                description="Transfer appreciating assets to heirs with minimal gift tax consequences"
                savings="Varies based on asset appreciation"
                icon={<TrendingUp className="h-5 w-5 text-green-300" />}
              />
              
              <StrategyCard
                title="Charitable Lead/Remainder Trusts"
                description="Reduce taxable estate while supporting charitable causes"
                savings="Up to 40% reduction in taxable estate"
                icon={<Heart className="h-5 w-5 text-pink-300" />}
              />
              
              <StrategyCard
                title="Qualified Personal Residence Trust (QPRT)"
                description="Transfer residence to heirs at reduced gift tax value"
                savings={`Approximately ${formatCurrency(estateValues.current.realEstate * 0.3)} in tax savings`}
                icon={<Home className="h-5 w-5 text-yellow-300" />}
              />
              
              <StrategyCard
                title="Family Limited Partnership"
                description="Transfer business interests at discounted values for gift tax purposes"
                savings="20-40% valuation discount possible"
                icon={<Briefcase className="h-5 w-5 text-purple-300" />}
              />
            </div>
          </CardContent>
        )}
      </Card>
      
      {/* State-Specific Considerations */}
      {profile.state && (
        <Alert className="bg-blue-900/20 border-blue-800">
          <Info className="h-4 w-4 text-blue-300" />
          <AlertTitle className="text-blue-100">State Tax Considerations</AlertTitle>
          <AlertDescription className="text-gray-300">
            {profile.state === 'NY' ? (
              <>
                New York has its own estate tax with a $6.94M exemption. The tax is "cliff" based - 
                if your estate exceeds 105% of the exemption, the entire estate becomes taxable. 
                Consider strategies to keep your estate below this threshold.
              </>
            ) : profile.state === 'FL' || profile.state === 'TX' ? (
              <>
                {profile.state} has no state estate or inheritance tax, providing significant savings 
                compared to high-tax states. This can save your heirs hundreds of thousands in state taxes.
              </>
            ) : (
              <>
                Check your state's specific estate and inheritance tax laws. Some states have lower 
                exemptions than the federal level, creating additional tax liability.
              </>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Tax Breakdown Component
function TaxBreakdown({ calculation, compact = false }: { calculation: TaxCalculation; compact?: boolean }) {
  return (
    <div className={`space-y-${compact ? '2' : '3'}`}>
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">Gross Estate</span>
        <span className="text-white">{formatCurrency(calculation.grossEstate)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">Deductions</span>
        <span className="text-white">-{formatCurrency(calculation.deductions)}</span>
      </div>
      <div className="flex justify-between text-sm font-semibold border-t border-gray-600 pt-2">
        <span className="text-gray-400">Taxable Estate</span>
        <span className="text-white">{formatCurrency(calculation.taxableEstate)}</span>
      </div>
      
      {!compact && (
        <>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Federal Exemption</span>
            <span className="text-green-400">{formatCurrency(calculation.federalExemption)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Federal Taxable</span>
            <span className="text-white">{formatCurrency(calculation.federalTaxableAmount)}</span>
          </div>
        </>
      )}
      
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">Federal Tax (40%)</span>
        <span className="text-red-400">{formatCurrency(calculation.federalTax)}</span>
      </div>
      
      {calculation.stateTax > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">State Tax</span>
          <span className="text-red-400">{formatCurrency(calculation.stateTax)}</span>
        </div>
      )}
      
      <div className="flex justify-between font-semibold border-t border-gray-600 pt-2">
        <span className="text-white">Total Tax Due</span>
        <span className="text-red-400">{formatCurrency(calculation.totalTax)}</span>
      </div>
      
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">Effective Rate</span>
        <span className="text-white">{calculation.effectiveRate.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// Strategy Card Component
function StrategyCard({ 
  title, 
  description, 
  savings, 
  icon 
}: { 
  title: string; 
  description: string; 
  savings: string; 
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-gray-700/30 rounded-lg p-4 flex gap-3">
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1">
        <h4 className="text-white font-medium">{title}</h4>
        <p className="text-gray-400 text-sm mt-1">{description}</p>
        <p className="text-green-400 text-sm mt-2 flex items-center gap-1">
          <ChevronRight className="h-3 w-3" />
          Potential savings: {savings}
        </p>
      </div>
    </div>
  );
}

