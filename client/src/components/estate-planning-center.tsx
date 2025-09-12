import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Home, 
  FileText, 
  Users, 
  Building, 
  Calculator,
  Info,
  Shield,
  AlertCircle,
  BookOpen,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { EstateOverview } from './estate/estate-overview';
import { OwnershipBeneficiaryAudit } from './estate/ownership-beneficiary-audit';
import { EstateTaxLiquidityAnalysis } from './estate/estate-tax-liquidity-analysis';
import { DocumentTracker } from './estate/document-tracker';
import { EstateRecommendations } from './estate/estate-recommendations';
import { TrustPlanning } from './estate/trust-planning';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { estatePlanningService } from '@/services/estate-planning.service';

interface EstatePlanningCenterProps {
  onClose?: () => void;
}

export function EstatePlanningCenter({ onClose }: EstatePlanningCenterProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const queryClient = useQueryClient();
  
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
  
  // Fetch estate plan data
  const { data: estatePlan, isLoading, error } = useQuery({
    queryKey: ['estate-plan'],
    queryFn: async () => {
      const response = await fetch('/api/estate-plan', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch estate plan');
      }
      const data = await response.json();
      return data; // Will be null if no plan exists
    },
  });

  // Auto-create estate plan from intake form data if none exists
  useEffect(() => {
    if (!isLoading && !estatePlan && profile && !isCreatingPlan && !error) {
      setIsCreatingPlan(true);
      estatePlanningService.createInitialEstatePlanFromProfile(profile)
        .then((newPlan) => {
          if (newPlan) {
            queryClient.invalidateQueries({ queryKey: ['estate-plan'] });
            queryClient.invalidateQueries({ queryKey: ['estate-documents'] });
            queryClient.invalidateQueries({ queryKey: ['estate-beneficiaries'] });
          }
        })
        .catch((err) => {
          console.error('Failed to create initial estate plan:', err);
        })
        .finally(() => {
          setIsCreatingPlan(false);
        });
    }
  }, [isLoading, estatePlan, profile, isCreatingPlan, error, queryClient]);

  // Update estate plan when profile changes
  useEffect(() => {
    if (estatePlan && profile && !isLoading) {
      // Calculate new estate values
      const assets = Array.isArray(profile.assets) ? profile.assets : [];
      const totalAssets = assets.reduce((sum: number, asset: any) => sum + (asset.value || 0), 0);
      
      const liabilities = Array.isArray(profile.liabilities) ? profile.liabilities : [];
      const totalLiabilities = liabilities.reduce((sum: number, liability: any) => sum + (liability.balance || 0), 0);
      
      const homeEquity = profile.primaryResidence ? 
        (profile.primaryResidence.marketValue || 0) - (profile.primaryResidence.mortgageBalance || 0) : 0;
      
      const additionalPropertiesEquity = Array.isArray(profile.additionalProperties) ? 
        profile.additionalProperties.reduce((sum: number, property: any) => 
          sum + ((property.marketValue || 0) - (property.mortgageBalance || 0)), 0) : 0;
      
      const totalEstateValue = totalAssets + homeEquity + additionalPropertiesEquity - totalLiabilities;
      
      // Check if values have changed significantly (more than 1% difference)
      const currentTotal = parseFloat(estatePlan.totalEstateValue || '0');
      const percentChange = Math.abs((totalEstateValue - currentTotal) / currentTotal);
      
      if (percentChange > 0.01 && totalEstateValue > 0) {
        // Update estate plan with new values
        estatePlanningService.updateEstatePlan(estatePlan.id, {
          totalEstateValue: totalEstateValue.toString(),
          liquidAssets: totalAssets.toString(),
          illiquidAssets: (homeEquity + additionalPropertiesEquity).toString(),
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['estate-plan'] });
        }).catch((err) => {
          console.error('Failed to update estate plan values:', err);
        });
      }
    }
  }, [profile, estatePlan, isLoading, queryClient]);

  const tabs = [
    { id: 'overview', label: '1. Estate Preview', icon: Home },
    { id: 'audit', label: '2. Ownership & Beneficiary', icon: Shield },
    { id: 'taxliquidity', label: '3. Tax & Liquidity', icon: Calculator },
    { id: 'documents', label: '4. Documents & Directives', icon: FileText },
    { id: 'trusts', label: '5. Advanced Strategies', icon: Building },
    { id: 'recommendations', label: '6. Insights', icon: TrendingUp },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <EstateOverview estatePlan={estatePlan as any} />;
      case 'audit':
        return <OwnershipBeneficiaryAudit estatePlanId={estatePlan?.id} />;
      case 'taxliquidity':
        return <EstateTaxLiquidityAnalysis estatePlanId={estatePlan?.id} />;
      case 'documents':
        return <DocumentTracker estatePlanId={estatePlan?.id} />;
      case 'recommendations':
        return <EstateRecommendations estatePlanId={estatePlan?.id} />;
      case 'trusts':
        return <TrustPlanning estatePlanId={estatePlan?.id} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Legal Disclaimer */}
      <Alert className="mb-6 bg-blue-900/20 border-blue-800">
        <AlertCircle className="h-4 w-4 text-blue-300" />
        <AlertTitle className="text-blue-100">Important Legal Notice</AlertTitle>
        <AlertDescription className="text-gray-300">
          This estate planning tool provides general information and calculations based on current tax laws. 
          It does not constitute legal or tax advice. Estate planning is complex and highly personal. 
          Please consult with a qualified estate planning attorney and tax professional for advice specific 
          to your situation. Laws vary by state and change frequently.
        </AlertDescription>
      </Alert>

      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-primary" />
              <CardTitle className="text-3xl text-white">Estate Planning Center</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/financial-profile'] });
                  queryClient.invalidateQueries({ queryKey: ['estate-plan'] });
                  queryClient.invalidateQueries({ queryKey: ['estate-documents'] });
                  queryClient.invalidateQueries({ queryKey: ['estate-beneficiaries'] });
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20 hover:shadow-purple-700/30 transition-all"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
              {onClose && (
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="text-gray-400 hover:text-white"
                >
                  Close
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-0 mb-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? 'default' : 'outline'}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-none ${
                    activeTab === tab.id
                      ? 'bg-[#8A00C4] hover:bg-[#7000A4] text-white border-[#8A00C4]'
                      : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Button>
              );
            })}
          </div>

          {/* Information Alert */}
          <Alert className="mb-6 bg-gray-700/50 border-gray-600">
            <Info className="h-4 w-4 text-gray-400" />
            <AlertDescription className="text-gray-300">
              {activeTab === 'overview' && 
                "Estate asset preview with three-column layout showing User, Spouse, and Joint ownership per CFP Board data collection standards."
              }
              {activeTab === 'audit' && 
                "Complete ownership and beneficiary audit to identify probate exposure, titling issues, and missing beneficiary designations."
              }
              {activeTab === 'taxliquidity' && 
                "Federal and state tax calculations with 2025 TCJA sunset modeling, plus liquidity stress-testing for settlement costs."
              }
              {activeTab === 'documents' && 
                "Track core estate documents including wills, trusts, powers of attorney, and digital asset directives per RUFADAA."
              }
              {activeTab === 'trusts' && 
                "Advanced strategies including credit shelter trusts, QTIPs, GRATs, ILITs, and charitable planning vehicles."
              }
              {/* No subtext for Insights tab per design update */}
              {activeTab === 'taxliability' && 
                "Detailed estate tax projections with separate analysis for each spouse and tax minimization strategies."
              }
              {activeTab === 'calculator' && 
                "Interactive calculator for federal and state estate taxes under different scenarios and planning strategies."
              }
            </AlertDescription>
          </Alert>

          {/* Tab Content */}
          {isLoading || isCreatingPlan ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-400">
                {isCreatingPlan ? 'Creating your estate plan from intake form data...' : 'Loading estate planning data...'}
              </div>
            </div>
          ) : (
            renderContent()
          )}
        </CardContent>
      </Card>
    </div>
  );
}
