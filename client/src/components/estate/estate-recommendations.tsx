import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Shield,
  FileText,
  Users,
  DollarSign,
  Clock,
  AlertCircle,
  Download,
  Sparkles,
  Target,
  Calculator,
  Home,
  Heart,
  BookOpen,
  Briefcase
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/utils';

interface EstateRecommendationsProps {
  estatePlanId?: number;
}

interface Recommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'tax' | 'liquidity' | 'documents' | 'beneficiaries' | 'trusts' | 'ownership';
  title: string;
  description: string;
  impact: string;
  timeframe: string;
  savings?: number;
  action: string;
  completed?: boolean;
}

export function EstateRecommendations({ estatePlanId }: EstateRecommendationsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch all necessary data
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

  const { data: documents } = useQuery({
    queryKey: ['estate-documents'],
    queryFn: async () => {
      const response = await fetch('/api/estate-documents', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
  });

  const { data: beneficiaries } = useQuery({
    queryKey: ['estate-beneficiaries'],
    queryFn: async () => {
      const response = await fetch('/api/estate-beneficiaries', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch beneficiaries');
      return response.json();
    },
  });

  const { data: ownershipData } = useQuery({
    queryKey: ['ownership-beneficiary-audit'],
    queryFn: async () => {
      const response = await fetch('/api/ownership-beneficiary-audit', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch ownership data');
      return response.json();
    },
    enabled: !!profile && !!estatePlan,
  });

  // Analyze data and generate recommendations using Gemini API
  useEffect(() => {
    if (profile && estatePlan) {
      generateRecommendations();
    }
  }, [profile, estatePlan, documents, beneficiaries, ownershipData]);

  const generateRecommendations = async () => {
    setLoading(true);
    const recs: Recommendation[] = [];
    
    // Calculate key metrics
    const estateValue = parseFloat(estatePlan?.totalEstateValue || '0');
    const liquidAssets = parseFloat(estatePlan?.liquidAssets || '0');
    const federalExemption = 13990000; // 2025 federal exemption
    const isMarried = profile?.maritalStatus === 'married';
    const totalExemption = isMarried ? federalExemption * 2 : federalExemption;
    
    // Check for TCJA sunset exposure
    if (estateValue > 7000000 && new Date().getFullYear() <= 2025) {
      recs.push({
        id: 'tcja-sunset',
        priority: 'critical',
        category: 'tax',
        title: 'TCJA Sunset Risk - Act Before 2026',
        description: `Your estate of ${formatCurrency(estateValue)} exceeds the post-2025 exemption (~$7M). The current $13.99M exemption expires end of 2025.`,
        impact: `Potential additional tax exposure of ${formatCurrency((estateValue - 7000000) * 0.4)} if no action taken`,
        timeframe: 'Before December 31, 2025',
        savings: (estateValue - 7000000) * 0.4,
        action: 'Consider lifetime gifting strategies or irrevocable trusts before sunset',
      });
    }

    // Check for portability election
    if (isMarried && estateValue > federalExemption) {
      recs.push({
        id: 'portability',
        priority: 'high',
        category: 'tax',
        title: 'Maximize Portability Election',
        description: 'Ensure proper portability election to preserve both spouses\' exemptions totaling $27.98M',
        impact: `Preserves up to ${formatCurrency(federalExemption)} in exemptions`,
        timeframe: '9 months after first death',
        savings: federalExemption * 0.4,
        action: 'File Form 706 timely even if no tax due',
      });
    }

    // Check for missing documents
    const essentialDocs = ['will', 'power_of_attorney', 'healthcare_proxy', 'living_will'];
    const missingDocs = essentialDocs.filter(docType => 
      !documents?.some((doc: any) => doc.documentType === docType && doc.status === 'current')
    );
    
    if (missingDocs.length > 0) {
      recs.push({
        id: 'missing-docs',
        priority: 'critical',
        category: 'documents',
        title: `Missing Essential Documents (${missingDocs.length})`,
        description: `Missing: ${missingDocs.map(d => d.replace('_', ' ')).join(', ')}`,
        impact: 'Family faces probate delays, court costs, and potential disputes',
        timeframe: 'Immediate',
        action: 'Schedule attorney consultation to draft missing documents',
      });
    }

    // Check liquidity for estate settlement
    const estimatedTax = Math.max(0, (estateValue - totalExemption) * 0.4);
    const settlementCosts = estateValue * 0.05; // 5% for admin, legal, etc.
    const totalNeeded = estimatedTax + settlementCosts;
    const liquidityGap = totalNeeded - liquidAssets;
    
    if (liquidityGap > 0) {
      recs.push({
        id: 'liquidity-gap',
        priority: 'high',
        category: 'liquidity',
        title: 'Estate Liquidity Shortfall',
        description: `Gap of ${formatCurrency(liquidityGap)} between liquid assets and settlement needs`,
        impact: 'Heirs may need to sell assets quickly at unfavorable prices',
        timeframe: '6-9 months',
        savings: liquidityGap * 0.15, // Avoid 15% fire sale discount
        action: 'Consider life insurance or asset reallocation strategy',
      });
    }

    // Check beneficiary designations - CFP Board best practices
    const accountsWithoutBeneficiaries = ownershipData?.assets?.filter((asset: any) => 
      asset.requiresBeneficiary && !asset.hasBeneficiary
    ) || [];
    
    // Separate by account type for specific recommendations
    const retirementWithoutBeneficiaries = accountsWithoutBeneficiaries.filter((a: any) => a.type === 'retirement');
    const lifeInsuranceWithoutBeneficiaries = accountsWithoutBeneficiaries.filter((a: any) => a.type === 'life_insurance');
    const bankInvestmentWithoutBeneficiaries = accountsWithoutBeneficiaries.filter((a: any) => 
      a.type === 'bank' || a.type === 'investment'
    );
    
    // Separate by owner if married
    const userAccountsWithoutBeneficiaries = accountsWithoutBeneficiaries.filter((a: any) => 
      !a.accountOwner || a.accountOwner === 'user'
    );
    const spouseAccountsWithoutBeneficiaries = accountsWithoutBeneficiaries.filter((a: any) => 
      a.accountOwner === 'spouse'
    );
    
    // Add spouse-specific recommendations if married
    if (isMarried && spouseAccountsWithoutBeneficiaries.length > 0) {
      const spouseRetirement = spouseAccountsWithoutBeneficiaries.filter((a: any) => a.type === 'retirement');
      const spouseOther = spouseAccountsWithoutBeneficiaries.filter((a: any) => a.type !== 'retirement');
      const totalValue = spouseAccountsWithoutBeneficiaries.reduce((sum: number, a: any) => sum + (a.value || 0), 0);
      
      recs.push({
        id: 'spouse-missing-beneficiaries',
        priority: spouseRetirement.length > 0 ? 'critical' : 'high',
        category: 'beneficiaries',
        title: `${profile.spouseName || 'Spouse'}'s ${spouseAccountsWithoutBeneficiaries.length} Accounts Need Beneficiaries`,
        description: `Spouse's accounts totaling ${formatCurrency(totalValue)} lack beneficiary designations`,
        impact: 'These accounts will go through probate, causing delays and costs',
        timeframe: spouseRetirement.length > 0 ? 'Immediate' : 'Within 30 days',
        savings: totalValue * 0.04,
        action: `Have ${profile.spouseName || 'spouse'} update beneficiary forms on all accounts`,
      });
    }
    
    // Critical: Retirement accounts without beneficiaries
    if (retirementWithoutBeneficiaries.length > 0) {
      const totalValue = retirementWithoutBeneficiaries.reduce((sum: number, a: any) => sum + (a.value || 0), 0);
      const accountNames = retirementWithoutBeneficiaries.map((a: any) => a.name).join(', ');
      
      recs.push({
        id: 'missing-retirement-beneficiaries',
        priority: 'critical',
        category: 'beneficiaries',
        title: `Critical: ${retirementWithoutBeneficiaries.length} Retirement Account${retirementWithoutBeneficiaries.length > 1 ? 's' : ''} Without Beneficiaries`,
        description: `${accountNames} totaling ${formatCurrency(totalValue)} lack beneficiary designations. These will be subject to probate and lose stretch IRA benefits.`,
        impact: `Unnecessary probate costs of ${formatCurrency(totalValue * 0.04)}, plus loss of tax-deferred growth for heirs`,
        timeframe: 'Immediate - Update within 7 days',
        savings: totalValue * 0.04, // Avoid 4% probate costs
        action: 'Contact each custodian immediately to add primary AND contingent beneficiaries',
      });
    }
    
    // Critical: Life insurance without beneficiaries
    if (lifeInsuranceWithoutBeneficiaries.length > 0) {
      const totalCoverage = lifeInsuranceWithoutBeneficiaries.reduce((sum: number, a: any) => sum + (a.value || 0), 0);
      
      recs.push({
        id: 'missing-life-insurance-beneficiaries',
        priority: 'critical',
        category: 'beneficiaries',
        title: `Critical: Life Insurance Without Beneficiaries`,
        description: `Life insurance coverage of ${formatCurrency(totalCoverage)} lacks beneficiary designation. Death benefits will be paid to estate, creating unnecessary taxes.`,
        impact: 'Death benefits become taxable part of estate, potential 40% tax on amount over exemption',
        timeframe: 'Immediate - Update within 24 hours',
        savings: totalCoverage > totalExemption ? (totalCoverage - totalExemption) * 0.4 : totalCoverage * 0.05,
        action: 'Contact insurance company TODAY to add primary and contingent beneficiaries',
      });
    }
    
    // High: Bank/Investment accounts with TOD/POD capability
    if (bankInvestmentWithoutBeneficiaries.length > 0) {
      const totalValue = bankInvestmentWithoutBeneficiaries.reduce((sum: number, a: any) => sum + (a.value || 0), 0);
      
      recs.push({
        id: 'missing-tod-pod-beneficiaries',
        priority: 'high',
        category: 'beneficiaries',
        title: `${bankInvestmentWithoutBeneficiaries.length} Bank/Investment Accounts Need TOD/POD Beneficiaries`,
        description: `Accounts totaling ${formatCurrency(totalValue)} could avoid probate with Transfer on Death (TOD) or Payable on Death (POD) designations`,
        impact: `Avoid probate delays of 6-12 months and costs of ${formatCurrency(totalValue * 0.03)}`,
        timeframe: 'Within 30 days',
        savings: totalValue * 0.03, // Avoid 3% probate costs
        action: 'Add TOD/POD beneficiaries to maintain privacy and speed asset transfer',
      });
    }
    
    // Check for spouse beneficiary on retirement accounts (if married)
    if (isMarried && retirementWithoutBeneficiaries.length === 0) {
      const retirementAccounts = ownershipData?.assets?.filter((a: any) => a.type === 'retirement') || [];
      const nonSpouseBeneficiaryAccounts = retirementAccounts.filter((a: any) => 
        a.beneficiary && !a.beneficiary.toLowerCase().includes(profile.spouseName?.toLowerCase() || 'spouse')
      );
      
      if (nonSpouseBeneficiaryAccounts.length > 0) {
        recs.push({
          id: 'retirement-spouse-beneficiary',
          priority: 'medium',
          category: 'beneficiaries',
          title: 'Review Non-Spouse Retirement Beneficiaries',
          description: `${nonSpouseBeneficiaryAccounts.length} retirement account${nonSpouseBeneficiaryAccounts.length > 1 ? 's' : ''} list non-spouse as primary beneficiary`,
          impact: 'Spouse loses ability to roll over to own IRA and stretch distributions',
          timeframe: 'Review within 60 days',
            action: 'Confirm this is intentional or update to spouse as primary, others as contingent',
        });
      }
    }
    
    // Check for outdated beneficiaries (divorce, death)
    const allBeneficiaryAccounts = ownershipData?.assets?.filter((a: any) => 
      a.requiresBeneficiary && a.hasBeneficiary
    ) || [];
    
    if (allBeneficiaryAccounts.length > 0 && profile?.previousMarriage) {
      recs.push({
        id: 'beneficiary-review-divorce',
        priority: 'high',
        category: 'beneficiaries',
        title: 'Post-Divorce Beneficiary Review Required',
        description: 'Previous marriage detected - beneficiary designations may need updating',
        impact: 'Ex-spouse may inherit assets unintentionally, causing family conflicts',
        timeframe: 'Within 14 days',
        action: 'Review ALL beneficiary designations to ensure they reflect current wishes',
      });
    }
    
    // Check for missing contingent beneficiaries (CFP Board best practice)
    const accountsWithPrimaryOnly = ownershipData?.assets?.filter((a: any) => 
      a.requiresBeneficiary && a.hasBeneficiary && !a.hasContingentBeneficiary
    ) || [];
    
    if (accountsWithPrimaryOnly.length > 0) {
      const totalValue = accountsWithPrimaryOnly.reduce((sum: number, a: any) => sum + (a.value || 0), 0);
      
      recs.push({
        id: 'missing-contingent-beneficiaries',
        priority: 'medium',
        category: 'beneficiaries',
        title: `Add Contingent Beneficiaries to ${accountsWithPrimaryOnly.length} Accounts`,
        description: `Accounts totaling ${formatCurrency(totalValue)} have primary but no contingent beneficiaries`,
        impact: 'If primary beneficiary predeceases you, assets go through probate',
        timeframe: 'Within 60 days',
        action: 'Add contingent beneficiaries and consider "per stirpes" designation for descendants',
      });
    }
    
    // Check estate beneficiaries (from will/trust) alignment
    const estateDistributionIssue = beneficiaries && beneficiaries.length > 0 && 
      beneficiaries.filter((b: any) => b.isPrimary).reduce((sum: number, b: any) => 
        sum + (b.distributionPercentage || 0), 0) !== 100;
    
    if (estateDistributionIssue) {
      recs.push({
        id: 'estate-distribution-mismatch',
        priority: 'high',
        category: 'beneficiaries',
        title: 'Estate Distribution Percentages Don\'t Total 100%',
        description: 'Primary beneficiaries in your will/trust don\'t add up to 100%, creating ambiguity',
        impact: 'Could lead to legal disputes and court interpretation of your wishes',
        timeframe: 'Fix within 30 days',
        action: 'Review Tab 6 beneficiary percentages and ensure they total exactly 100%',
      });
    }

    // Check for charitable intent
    if (profile?.charitableGiving && estateValue > totalExemption) {
      recs.push({
        id: 'charitable-planning',
        priority: 'medium',
        category: 'trusts',
        title: 'Charitable Estate Planning Opportunity',
        description: 'Reduce estate taxes while supporting causes you care about',
        impact: `Tax deduction up to ${formatCurrency(estateValue * 0.1)} at 40% rate`,
        timeframe: 'Next 12 months',
        savings: estateValue * 0.1 * 0.4,
        action: 'Explore charitable remainder trusts or donor advised funds',
      });
    }

    // Check for business succession planning
    if (profile?.businessOwnership) {
      recs.push({
        id: 'business-succession',
        priority: 'high',
        category: 'ownership',
        title: 'Business Succession Planning Needed',
        description: 'Ensure smooth transition and minimize estate taxes on business interests',
        impact: 'Protect business value and family harmony',
        timeframe: 'Next 6 months',
        action: 'Consider buy-sell agreements, key person insurance, and valuation discounts',
      });
    }

    // Check for asset titling issues
    const jointlyOwnedAssets = ownershipData?.assets?.filter((asset: any) => 
      asset.ownership === 'joint'
    ) || [];
    
    if (isMarried && jointlyOwnedAssets.length > 3) {
      recs.push({
        id: 'asset-titling',
        priority: 'medium',
        category: 'ownership',
        title: 'Review Joint Asset Titling Strategy',
        description: 'Excessive joint ownership may limit tax planning flexibility',
        impact: 'Could save estate taxes by optimizing ownership structure',
        timeframe: 'Next 3 months',
        action: 'Consider rebalancing ownership for optimal exemption use',
      });
    }

    // Sort recommendations by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    setRecommendations(recs);
    setLoading(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-900/20 border-red-800 text-red-400';
      case 'high': return 'bg-orange-900/20 border-orange-800 text-orange-400';
      case 'medium': return 'bg-yellow-900/20 border-yellow-800 text-yellow-400';
      case 'low': return 'bg-blue-900/20 border-blue-800 text-blue-400';
      default: return 'bg-gray-900/20 border-gray-800 text-gray-400';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'tax': return <Calculator className="h-5 w-5" />;
      case 'liquidity': return <DollarSign className="h-5 w-5" />;
      case 'documents': return <FileText className="h-5 w-5" />;
      case 'beneficiaries': return <Users className="h-5 w-5" />;
      case 'trusts': return <Shield className="h-5 w-5" />;
      case 'ownership': return <Home className="h-5 w-5" />;
      default: return <AlertCircle className="h-5 w-5" />;
    }
  };

  const filteredRecommendations = selectedCategory === 'all' 
    ? recommendations 
    : recommendations.filter(rec => rec.category === selectedCategory);

  const totalSavings = recommendations.reduce((sum, rec) => sum + (rec.savings || 0), 0);
  const criticalCount = recommendations.filter(rec => rec.priority === 'critical').length;
  const completedCount = recommendations.filter(rec => rec.completed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Sparkles className="h-8 w-8 text-purple-400 animate-pulse mx-auto mb-4" />
          <p className="text-gray-400">Analyzing your estate plan and generating recommendations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-white">Insights</h3>
        </div>
        <Button className="bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/20">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Recommendations</p>
                <p className="text-2xl font-bold text-white">{recommendations.length}</p>
              </div>
              <Target className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Critical Actions</p>
                <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Potential Savings</p>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(totalSavings)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Progress</p>
                <Progress value={(completedCount / recommendations.length) * 100} className="mt-2" />
              </div>
              <CheckCircle2 className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('all')}
          className={selectedCategory === 'all' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}
        >
          All Categories
        </Button>
        {['tax', 'liquidity', 'documents', 'beneficiaries', 'trusts', 'ownership'].map(category => (
          <Button
            key={category}
            variant={selectedCategory === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category)}
            className={selectedCategory === category ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}
          >
            {getCategoryIcon(category)}
            <span className="ml-2 capitalize">{category}</span>
          </Button>
        ))}
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {filteredRecommendations.map((rec) => (
          <Card key={rec.id} className="bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${getPriorityColor(rec.priority).replace('text-', 'bg-').replace('-400', '-900/20')}`}>
                  {getCategoryIcon(rec.category)}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-lg font-semibold text-white">{rec.title}</h4>
                    <Badge className={getPriorityColor(rec.priority)}>
                      {rec.priority.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <p className="text-gray-300 mb-3">{rec.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-400">Impact</p>
                        <p className="text-sm text-gray-200">{rec.impact}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 text-blue-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-400">Timeframe</p>
                        <p className="text-sm text-gray-200">{rec.timeframe}</p>
                      </div>
                    </div>
                    
                    {rec.savings && (
                      <div className="flex items-start gap-2">
                        <DollarSign className="h-4 w-4 text-green-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-400">Potential Savings</p>
                          <p className="text-sm text-green-400 font-semibold">{formatCurrency(rec.savings)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Alert className="bg-gray-700/30 border-gray-600">
                    <AlertDescription className="text-sm text-gray-300">
                      <strong className="text-white">Action Required:</strong> {rec.action}
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredRecommendations.length === 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-400 mb-4" />
            <h4 className="text-lg font-semibold text-white mb-2">
              {selectedCategory === 'all' ? 'No recommendations at this time' : `No ${selectedCategory} recommendations`}
            </h4>
            <p className="text-gray-400">
              Your estate plan is well-optimized in this area. Check back periodically for updates.
            </p>
          </CardContent>
        </Card>
      )}

      {/* AI analysis note removed per design update */}
    </div>
  );
}
