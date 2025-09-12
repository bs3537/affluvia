import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Calculator,
  DollarSign,
  TrendingUp,
  Building2,
  Receipt,
  Calendar,
  PiggyBank,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Info,
  FileText,
  Briefcase
} from "lucide-react";
import { RetirementPlanComparison } from "./retirement-plan-comparison";
import { DeductionOptimizer } from "./deduction-optimizer";
import { QuarterlyTaxCalculator } from "./quarterly-tax-calculator";
import { SCorpAnalyzer } from "./s-corp-analyzer";
import { BusinessStructureAdvisor } from "./business-structure-advisor";

interface SelfEmployedData {
  isSelfEmployed: boolean;
  selfEmploymentIncome: number;
  businessType?: string;
  hasRetirementPlan: boolean;
  quarterlyTaxPayments?: any[];
  deductions?: any;
  recommendations?: SelfEmployedRecommendation[];
  totalPotentialSavings?: number;
}

interface SelfEmployedRecommendation {
  title: string;
  description: string;
  estimatedSavings: number;
  urgency: 'high' | 'medium' | 'low';
  category: string;
  actionItems: string[];
  deadline?: string;
}

export function SelfEmployedStrategiesTab() {
  const [activeTab, setActiveTab] = useState("retirement");
  const [loadingTimer, setLoadingTimer] = useState(0);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch user profile with self-employed data - use same key as parent
  const { data: userProfile, isLoading } = useQuery({
    queryKey: ["/api/financial-profile", user?.id],
    queryFn: async () => {
      const response = await fetch("/api/financial-profile", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch profile");
      return response.json();
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Loading timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isLoading) {
      setLoadingTimer(0);
      interval = setInterval(() => {
        setLoadingTimer((prev) => prev + 0.1);
      }, 100);
    } else {
      setLoadingTimer(0);
      if (interval) clearInterval(interval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  // Fetch self-employed recommendations
  const { data: recommendations, isLoading: isLoadingRecs } = useQuery({
    queryKey: ["self-employed-recommendations"],
    queryFn: async () => {
      const response = await fetch("/api/self-employed/recommendations", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch recommendations");
      return response.json();
    },
    enabled: !!userProfile?.isSelfEmployed
  });

  // Calculate total potential savings
  const totalPotentialSavings = recommendations?.recommendations?.reduce(
    (total: number, rec: SelfEmployedRecommendation) => total + (rec.estimatedSavings || 0),
    0
  ) || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8A00C4] mx-auto mb-4"></div>
          <p className="text-gray-400 mb-2">Loading self-employed strategies...</p>
          <p className="text-sm text-gray-500">{loadingTimer.toFixed(1)}s</p>
        </div>
      </div>
    );
  }

  // Previously, this tab gated content when a retirement plan existed.
  // That gating is removed so self-employed users with existing plans still see strategies.

  // Determine which spouse is self-employed and get their income
  const userIsSelfEmployed = userProfile?.employmentStatus === 'self-employed' || 
                             userProfile?.employmentStatus === 'business-owner';
  const spouseIsSelfEmployed = userProfile?.spouseEmploymentStatus === 'self-employed' || 
                               userProfile?.spouseEmploymentStatus === 'business-owner';
  
  // Get the appropriate income based on who is self-employed
  let rawSelfEmploymentIncome = 0;
  if (userIsSelfEmployed) {
    rawSelfEmploymentIncome = userProfile?.selfEmploymentIncome || userProfile?.annualIncome || 0;
  } else if (spouseIsSelfEmployed) {
    rawSelfEmploymentIncome = userProfile?.spouseAnnualIncome || 0;
  } else {
    // Fallback if neither is marked but isSelfEmployed flag is set
    rawSelfEmploymentIncome = userProfile?.selfEmploymentIncome || userProfile?.annualIncome || 0;
  }
  
  // Convert to number and remove decimals
  const selfEmploymentIncome = Math.floor(Number(rawSelfEmploymentIncome));
  
  // Calculate retirement savings for the self-employed person only
  const currentRetirementSavings = userProfile?.assets 
    ? userProfile.assets
        .filter((asset: any) => {
          // Check if this is a retirement account
          const isRetirementAccount = 
            asset.type?.toLowerCase().includes('401k') || 
            asset.type?.toLowerCase().includes('ira') || 
            asset.type?.toLowerCase().includes('403b') || 
            asset.type?.toLowerCase().includes('pension') ||
            asset.type?.toLowerCase().includes('retirement') ||
            asset.type?.toLowerCase().includes('sep') ||
            asset.type?.toLowerCase().includes('simple') ||
            asset.type?.toLowerCase().includes('457');
          
          if (!isRetirementAccount) return false;
          
          // Include based on who is self-employed
          if (userIsSelfEmployed && !spouseIsSelfEmployed) {
            // Only user is self-employed - include user's accounts
            return asset.owner?.toLowerCase() === 'user' || !asset.owner || asset.owner === '';
          } else if (spouseIsSelfEmployed && !userIsSelfEmployed) {
            // Only spouse is self-employed - include spouse's accounts
            return asset.owner?.toLowerCase() === 'spouse';
          } else if (userIsSelfEmployed && spouseIsSelfEmployed) {
            // Both are self-employed - include all retirement accounts
            return true;
          } else {
            // Neither is self-employed (shouldn't happen on this page) - include user's accounts as default
            return asset.owner?.toLowerCase() === 'user' || !asset.owner || asset.owner === '';
          }
        })
        .reduce((sum: number, asset: any) => sum + (Number(asset.value) || 0), 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Quick Assessment Card */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Briefcase className="h-5 w-5 text-blue-400" />
            Self-Employed Tax Optimization Center
          </CardTitle>
          <CardDescription className="text-gray-400">
            Maximize your tax savings with strategies designed for self-employed professionals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600">
              <p className="text-sm text-gray-400">Annual Self-Employment Income</p>
              <p className="text-2xl font-bold text-white">${selfEmploymentIncome.toLocaleString()}</p>
            </div>
            <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600">
              <p className="text-sm text-gray-400">Current Retirement Savings</p>
              <p className="text-2xl font-bold text-white">${currentRetirementSavings.toLocaleString()}</p>
            </div>
            <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600">
              <p className="text-sm text-gray-400">Estimated Tax Savings Potential</p>
              <p className="text-2xl font-bold text-green-400">
                ${totalPotentialSavings.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      {recommendations?.recommendations?.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="h-5 w-5 text-green-400" />
              Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.recommendations
                .sort((a: SelfEmployedRecommendation, b: SelfEmployedRecommendation) => {
                  const urgencyOrder = { high: 0, medium: 1, low: 2 };
                  return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
                })
                .slice(0, 3)
                .map((rec: SelfEmployedRecommendation, index: number) => {
                  // Use the retirement plan details from recommendations API for retirement plans
                  let displaySavings = rec.estimatedSavings;
                  if (recommendations.retirementPlanDetails && rec.category === 'retirement') {
                    // Use the consistent values from backend
                    if (rec.title.includes('Solo 401(k)') && recommendations.retirementPlanDetails.solo401k) {
                      displaySavings = Math.floor(recommendations.retirementPlanDetails.solo401k.taxSavings);
                    } else if (rec.title.includes('SEP IRA') && recommendations.retirementPlanDetails.sepIRA) {
                      displaySavings = Math.floor(recommendations.retirementPlanDetails.sepIRA.taxSavings);
                    } else if (rec.title.includes('SIMPLE IRA') && recommendations.retirementPlanDetails.simpleIRA) {
                      displaySavings = Math.floor(recommendations.retirementPlanDetails.simpleIRA.taxSavings);
                    }
                  }
                  
                  return (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-gray-700/30 border border-gray-600">
                      <div className="mt-1">
                        {rec.urgency === 'high' && <AlertCircle className="h-5 w-5 text-red-400" />}
                        {rec.urgency === 'medium' && <Info className="h-5 w-5 text-yellow-400" />}
                        {rec.urgency === 'low' && <CheckCircle className="h-5 w-5 text-green-400" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-white">{rec.title}</h4>
                            <p className="text-sm text-gray-400 mt-1">{rec.description}</p>
                          </div>
                          <Badge variant={rec.urgency === 'high' ? 'destructive' : rec.urgency === 'medium' ? 'default' : 'secondary'}>
                            ${displaySavings.toLocaleString()}
                          </Badge>
                        </div>
                        {rec.deadline && (
                          <div className="flex items-center gap-1 mt-2">
                            <Calendar className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-400">Deadline: {rec.deadline}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategy Tabs */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-5 w-full bg-gray-800/50">
              <TabsTrigger 
                value="retirement" 
                className="text-xs data-[state=active]:bg-[#8A00C4] data-[state=active]:text-white data-[state=active]:border-2 data-[state=active]:border-[#8A00C4] data-[state=active]:shadow-lg data-[state=active]:shadow-[#8A00C4]/20 bg-gray-800 border-2 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-600 transition-all duration-200"
              >
                <PiggyBank className="h-4 w-4 mr-1" />
                Retirement Plans
              </TabsTrigger>
              <TabsTrigger 
                value="deductions" 
                className="text-xs data-[state=active]:bg-[#8A00C4] data-[state=active]:text-white data-[state=active]:border-2 data-[state=active]:border-[#8A00C4] data-[state=active]:shadow-lg data-[state=active]:shadow-[#8A00C4]/20 bg-gray-800 border-2 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-600 transition-all duration-200"
              >
                <Receipt className="h-4 w-4 mr-1" />
                Tax Deductions
              </TabsTrigger>
              <TabsTrigger 
                value="quarterly" 
                className="text-xs data-[state=active]:bg-[#8A00C4] data-[state=active]:text-white data-[state=active]:border-2 data-[state=active]:border-[#8A00C4] data-[state=active]:shadow-lg data-[state=active]:shadow-[#8A00C4]/20 bg-gray-800 border-2 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-600 transition-all duration-200"
              >
                <Calendar className="h-4 w-4 mr-1" />
                Quarterly Taxes
              </TabsTrigger>
              <TabsTrigger 
                value="scorp" 
                className="text-xs data-[state=active]:bg-[#8A00C4] data-[state=active]:text-white data-[state=active]:border-2 data-[state=active]:border-[#8A00C4] data-[state=active]:shadow-lg data-[state=active]:shadow-[#8A00C4]/20 bg-gray-800 border-2 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-600 transition-all duration-200"
              >
                <Building2 className="h-4 w-4 mr-1" />
                S-Corp Analysis
              </TabsTrigger>
              <TabsTrigger 
                value="structure" 
                className="text-xs data-[state=active]:bg-[#8A00C4] data-[state=active]:text-white data-[state=active]:border-2 data-[state=active]:border-[#8A00C4] data-[state=active]:shadow-lg data-[state=active]:shadow-[#8A00C4]/20 bg-gray-800 border-2 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-600 transition-all duration-200"
              >
                <FileText className="h-4 w-4 mr-1" />
                Business Structure
              </TabsTrigger>
            </TabsList>

            <TabsContent value="retirement" className="mt-6">
              <RetirementPlanComparison userProfile={userProfile} />
            </TabsContent>

            <TabsContent value="deductions" className="mt-6">
              <DeductionOptimizer userProfile={userProfile} />
            </TabsContent>

            <TabsContent value="quarterly" className="mt-6">
              <QuarterlyTaxCalculator userProfile={userProfile} />
            </TabsContent>

            <TabsContent value="scorp" className="mt-6">
              <SCorpAnalyzer userProfile={userProfile} />
            </TabsContent>

            <TabsContent value="structure" className="mt-6">
              <BusinessStructureAdvisor userProfile={userProfile} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Resources */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg text-white">Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button className="justify-start bg-gray-700/50 border border-gray-600 text-gray-100 hover:bg-gray-700 hover:text-white hover:border-gray-500 transition-colors" asChild>
              <a href="https://www.irs.gov/businesses/small-businesses-self-employed/self-employed-individuals-tax-center" target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4 mr-2" />
                IRS Self-Employed Tax Center
              </a>
            </Button>
            <Button className="justify-start bg-gray-700/50 border border-gray-600 text-gray-100 hover:bg-gray-700 hover:text-white hover:border-gray-500 transition-colors" asChild>
              <a href="https://www.irs.gov/retirement-plans/retirement-plans-for-self-employed-people" target="_blank" rel="noopener noreferrer">
                <PiggyBank className="h-4 w-4 mr-2" />
                IRS Retirement Plans Guide
              </a>
            </Button>
            <Button className="justify-start bg-gray-700/50 border border-gray-600 text-gray-100 hover:bg-gray-700 hover:text-white hover:border-gray-500 transition-colors" asChild>
              <a href="https://www.irs.gov/forms-pubs/about-form-1040-es" target="_blank" rel="noopener noreferrer">
                <Calculator className="h-4 w-4 mr-2" />
                Form 1040-ES Instructions
              </a>
            </Button>
            <Button className="justify-start bg-gray-700/50 border border-gray-600 text-gray-100 hover:bg-gray-700 hover:text-white hover:border-gray-500 transition-colors" asChild>
              <a href="https://www.irs.gov/businesses/small-businesses-self-employed/s-corporations" target="_blank" rel="noopener noreferrer">
                <Building2 className="h-4 w-4 mr-2" />
                S-Corporation Guide
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
