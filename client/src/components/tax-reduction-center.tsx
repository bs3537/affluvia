import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Receipt,
  FileUp,
  Calculator,
  TrendingDown,
  DollarSign,
  FileText,
  Info,
  CheckCircle,
  AlertCircle,
  Loader2,
  Brain,
  Target,
  PiggyBank,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  XCircle,
  RefreshCw
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TaxOverview } from "./tax-overview";
import { SelfEmployedStrategiesTab } from "./self-employed-strategies-tab";
import { TaxGamification, useGamification } from "./gamification/gamification-wrapper";
import { useAuth } from "@/hooks/use-auth";

interface TaxStrategy {
  title: string;
  description: string;
  estimatedSavings: number;
  implementation: string[];
  priority: number;
}

interface TaxAnalysisResult {
  strategies: TaxStrategy[];
  currentTaxLiability: number;
  projectedTaxLiability: number;
  totalPotentialSavings: number;
  effectiveTaxRate: number;
  marginalTaxRate: number;
  extractedTaxData?: {
    adjustedGrossIncome: number;
    totalDeductions: number;
    taxableIncome: number;
    filingStatus: string | null;
    dependentCount: number;
    federalTaxesPaid: number;
    stateTaxesPaid: number;
    w2Income: number;
    selfEmploymentIncome: number;
    investmentIncome: number;
    extractionDate: string;
  };
}

interface HyperpersonalizedRecommendation {
  title: string;
  description: string;
  urgency?: number;
  estimatedAnnualSavings?: number;
  estimatedSavings?: number;
  implementationTimeframe?: string;
  actionItems?: string[];
  implementation?: string[];
  requirements?: string[];
  risks?: string;
  deadline?: string;
  priority?: number;
}

interface TaxRecommendationsResult {
  recommendations: HyperpersonalizedRecommendation[];
  totalEstimatedSavings: number;
  priority?: string;
  lastUpdated?: string;
  currentTaxLiability?: number;
  projectedTaxLiability?: number;
  effectiveTaxRate?: number;
  marginalTaxRate?: number;
}

interface AIRothAnalysisResult {
  analysis: {
    currentSituation: string;
    keyConsiderations: string[];
  };
  baselineScenario: {
    name: string;
    philosophy: string;
    projections: {
      lifetimeIncomeTaxes: number;
      afterTaxEstateValueAt85: number;
      totalIRMAARisk: number;
      bracketCreepRisk: string;
      totalRMDsOverLifetime: number;
    };
    pros: string[];
    cons: string[];
  };
  strategies: Array<{
    name: string;
    philosophy: string;
    annualConversions: Array<{
      year: number;
      age: number;
      conversionAmount: number;
      taxOwed: number;
      marginalRate: string;
    }>;
    projections: {
      lifetimeIncomeTaxes: number;
      afterTaxEstateValueAt85: number;
      totalIRMAARisk: number;
      bracketCreepRisk: string;
      totalRMDsOverLifetime: number;
    };
    pros: string[];
    cons: string[];
    comparisonToBaseline: {
      additionalTaxesPaid: number;
      additionalEstateValue: number;
      netBenefit: number;
    };
  }>;
  recommendation: {
    selectedStrategy: string;
    ranking: string[];
    justification: string;
    implementationPlan: {
      nextFiveYears: Array<{
        year: number;
        age: number;
        conversionAmount: number;
        taxOwed: number;
        taxPaymentSource: string;
        actions: string[];
      }>;
      keyMilestones: string[];
      riskMitigation: string[];
    };
  };
  disclaimer: string;
}

// Helper functions
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Calculate age from date of birth
const calculateAge = (dateOfBirth: string): number => {
  if (!dateOfBirth) return 0;
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

function TaxReductionCenterContent() {
  const [activeTab, setActiveTab] = useState("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const { trackAction } = useGamification();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [incomeChange, setIncomeChange] = useState("same");
  const [incomeChangeDetails, setIncomeChangeDetails] = useState("");
  const [deductionChange, setDeductionChange] = useState("same");
  const [deductionChangeDetails, setDeductionChangeDetails] = useState("");
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisTimer, setAnalysisTimer] = useState(0);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<AIRothAnalysisResult | null>(null);
  const [lastCalculatedAt, setLastCalculatedAt] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  // Readiness assessment removed: no detailed tests UI
  const [showRothPrimer, setShowRothPrimer] = useState(true);
  
  // Store previous user ID to detect user changes
  const [previousUserId, setPreviousUserId] = useState<number | null>(null);

  // Check for existing analysis on component mount and when user changes
  useEffect(() => {
    if (!user?.id) return;
    
    let mounted = true;
    
    const checkExistingAnalysis = async () => {
      // If user has changed, clear all cached tax data
      if (previousUserId && previousUserId !== user.id) {
        // Clear React Query cache for tax-related queries
        queryClient.removeQueries({ queryKey: ["taxAnalysisResult"] });
        queryClient.removeQueries({ queryKey: ["taxRecommendations"] });
        queryClient.removeQueries({ queryKey: ["taxOverview"] });
        
        // Reset all state
        if (mounted) {
          setAnalysisComplete(false);
          setActiveTab("upload");
          setUploadedFile(null);
          setIncomeChange("same");
          setIncomeChangeDetails("");
          setDeductionChange("same");
          setDeductionChangeDetails("");
          setAiAnalysisResult(null);
          setShowRecommendations(false);
        }
        
        // Update the previous user ID
        setPreviousUserId(user.id);
        return; // Don't check for existing analysis when user switches
      }
      
      // Update previous user ID if not set
      if (!previousUserId) {
        setPreviousUserId(user.id);
      }
      
      try {
        const response = await fetch("/api/tax-analysis-result", {
          credentials: "include",
        });
        if (response.ok && mounted) {
          const data = await response.json();
          if (data && data.strategies) {
            setAnalysisComplete(true);
            // Ensure persisted results show without re-uploading
            setShowRecommendations(true);
            // Track tax strategy completion achievement only once
            if (mounted) {
              trackAction('tax-strategy-completion', 'tax-strategies', 1);
            }
          }
        }
      } catch (error) {
        // No existing analysis, start fresh
        console.log("No existing tax analysis found");
      }
    };
    
    checkExistingAnalysis();
    
    return () => {
      mounted = false;
    };
  }, [user?.id, previousUserId, queryClient]); // Include previousUserId and queryClient in dependencies

  const analyzeTaxReturnMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/analyze-tax-return", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to analyze tax return");
      }
      return response.json();
    },
    onSuccess: () => {
      setAnalysisComplete(true);
      setShowRecommendations(true);
      // Track tax document upload and analysis completion
      trackAction('tax-document-upload', 'tax-strategies', 1);
      trackAction('tax-analysis-completion', 'tax-strategies', 1);
      // Track tax opportunities found (matches "deduction-detective" achievement)
      // Trigger multiple times since achievement requires 5 opportunities
      for (let i = 0; i < 5; i++) {
        trackAction('tax-opportunities', 'tax-strategies', 1);
      }
      // Track strategy implementation (matches "strategy-specialist" achievement)
      for (let i = 0; i < 3; i++) {
        trackAction('strategy-implementation', 'tax-strategies', 1);
      }
      // Generate comprehensive recommendations after analysis
      generateRecommendationsMutation.mutate();
      // Refetch to ensure we have the latest data
      refetch();
    },
  });

  const { data: analysisResult, isLoading: isLoadingResults, refetch } = useQuery<TaxAnalysisResult>({
    queryKey: ["taxAnalysisResult", user?.id],
    queryFn: async (): Promise<TaxAnalysisResult> => {
      const response = await fetch("/api/tax-analysis-result", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch analysis results");
      }
      return response.json();
    },
    enabled: !!user?.id && analysisComplete,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus to avoid overwriting user's current analysis
    refetchOnMount: false, // Don't refetch on mount if data is already cached
    retry: 1, // Only retry once on failure
  });

  // Query for hyperpersonalized tax recommendations
  const { data: taxRecommendations, isLoading: isLoadingRecommendations, refetch: refetchRecommendations } = useQuery<TaxRecommendationsResult>({
    queryKey: ["taxRecommendations", user?.id],
    queryFn: async (): Promise<TaxRecommendationsResult> => {
      const response = await fetch("/api/tax-recommendations", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch tax recommendations");
      }
      return response.json();
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  // Query for user financial profile to check Roth conversion eligibility
  const { data: userProfile, refetch: refetchUserProfile, isRefetching, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["/api/financial-profile", user?.id],
    queryFn: async () => {
      // Remove timestamp and cache-busting headers to allow proper caching for faster loading
      const response = await fetch("/api/financial-profile", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch financial profile");
      }
      return response.json();
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000, // Reduced to 2 minutes for faster updates
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnMount: true, // FIXED: Allow immediate data loading on mount for faster UX
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Query for self-employment eligibility to conditionally show tab
  const { data: selfEmploymentEligibility, isLoading: isLoadingSelfEmploymentEligibility } = useQuery({
    queryKey: ["self-employment-eligibility", user?.id],
    queryFn: async () => {
      const response = await fetch("/api/check-self-employment-eligibility", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to check self-employment eligibility");
      }
      return response.json();
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000, // 10 minutes (longer since employment status changes rarely)
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Clear AI analysis when profile changes
  useEffect(() => {
    // When userProfile changes, clear the AI analysis to force re-analysis with new data
    setAiAnalysisResult(null);
  }, [userProfile]);

  // Mutation to generate new tax recommendations
  const generateRecommendationsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/generate-tax-recommendations", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to generate tax recommendations");
      }
      return response.json();
    },
    onSuccess: () => {
      refetchRecommendations();
    },
  });

  // AI Roth Conversion Analysis Mutation
  const aiRothAnalysisMutation = useMutation({
    mutationFn: async (): Promise<AIRothAnalysisResult> => {
      const response = await fetch("/api/roth-conversion/ai-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to generate AI Roth conversion analysis");
      }
      return response.json();
    },
    onMutate: () => {
      // State is already set in handleAIAnalysis, no need to duplicate
    },
    onSuccess: (data) => {
      setAiAnalysisResult(data);
      setLastCalculatedAt(new Date().toISOString());
      setAnalysisError(null);
      setIsAnalyzing(false);
      
      // Invalidate stored analysis cache to refresh with newly saved results
      queryClient.invalidateQueries({ queryKey: ["stored-roth-conversion-analysis", user?.id] });
    },
    onError: (error) => {
      setAnalysisError(error.message);
      setIsAnalyzing(false);
    },
  });

  // Query for stored Roth conversion analysis results
  const { data: storedRothAnalysis, isLoading: isLoadingStoredRoth } = useQuery({
    queryKey: ["stored-roth-conversion-analysis", user?.id],
    queryFn: async () => {
      const response = await fetch("/api/roth-conversion/analysis", {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No stored analysis found
        }
        throw new Error("Failed to fetch stored Roth conversion analysis");
      }
      return response.json();
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Load stored analysis results into state when available
  useEffect(() => {
    if (storedRothAnalysis && storedRothAnalysis.hasAnalysis && !aiAnalysisResult) {
      setAiAnalysisResult(storedRothAnalysis.results);
      const ts = storedRothAnalysis.calculatedAt || storedRothAnalysis.results?.calculatedAt;
      if (ts) setLastCalculatedAt(ts);
    }
  }, [storedRothAnalysis, aiAnalysisResult]);

  // Handle AI analysis trigger
  const handleAIAnalysis = async () => {
    try {
      // Set analyzing state immediately to show loading
      setIsAnalyzing(true);
      setAnalysisError(null);
      setAiAnalysisResult(null);
      
      // Invalidate and refetch user profile to ensure we have the latest data
      await queryClient.invalidateQueries({ queryKey: ["/api/financial-profile", user?.id] });
      await refetchUserProfile();
      
      // Now trigger the analysis mutation
      aiRothAnalysisMutation.mutate();
    } catch (error) {
      console.error("Error triggering AI analysis:", error);
      setAnalysisError("Failed to start analysis. Please try again.");
      setIsAnalyzing(false);
    }
  };

  // Timer effect for analysis
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (analyzeTaxReturnMutation.isPending) {
      setAnalysisTimer(0);
      interval = setInterval(() => {
        setAnalysisTimer(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [analyzeTaxReturnMutation.isPending]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setUploadedFile(file);
    } else {
      alert("Please upload a PDF file");
    }
  };

  const handleAnalyze = () => {
    const formData = new FormData();
    
    // Add tax return if uploaded (optional)
    if (uploadedFile) {
      formData.append("taxReturn", uploadedFile);
    }
    
    // Always include the expected changes data
    formData.append("incomeChange", incomeChange);
    formData.append("incomeChangeDetails", incomeChangeDetails);
    formData.append("deductionChange", deductionChange);
    formData.append("deductionChangeDetails", deductionChangeDetails);
    
    // Flag to indicate comprehensive analysis
    formData.append("comprehensiveAnalysis", "true");

    analyzeTaxReturnMutation.mutate(formData);
  };

  // Calculate total tax-deferred assets for a specific owner
  const calculateTaxDeferredAssets = (assets: any[], owner: string): number => {
    if (!assets || !Array.isArray(assets)) return 0;
    
    const taxDeferredTypes = [
      '401k',
      '403b', 
      'traditional-ira',
      'other-tax-deferred',
      'hsa',
      'qualified-annuities'
    ];

    return assets
      .filter(asset => 
        taxDeferredTypes.includes(asset.type) && 
        (asset.owner === owner || asset.owner === `${owner}`)
      )
      .reduce((total, asset) => total + (parseFloat(asset.value?.toString() || '0') || 0), 0);
  };

  // Check Roth conversion eligibility
  const checkRothConversionEligibility = () => {
    if (!userProfile) return { eligible: false, userEligible: false, spouseEligible: false, userAssets: 0, spouseAssets: 0 };

    const userAge = calculateAge(userProfile.dateOfBirth);
    const spouseAge = userProfile.spouseDateOfBirth ? calculateAge(userProfile.spouseDateOfBirth) : 0;
    
    const assets = userProfile.assets || [];
    const userAssets = calculateTaxDeferredAssets(assets, 'user') + calculateTaxDeferredAssets(assets, 'self');
    const spouseAssets = calculateTaxDeferredAssets(assets, 'spouse');

    const userEligible = userAge >= 57 && userAssets >= 250000;
    const spouseEligible = spouseAge >= 57 && spouseAssets >= 250000;

    return {
      eligible: userEligible || spouseEligible,
      userEligible,
      spouseEligible,
      userAssets,
      spouseAssets,
      userAge,
      spouseAge
    };
  };

  // Roth Conversion Tile Component
  const RothConversionTile = () => {
    const eligibility = checkRothConversionEligibility();
    
    if (!eligibility.eligible) return null;

    return (
      <Card className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-purple-500/30 mt-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center">
              <TrendingDown className="h-6 w-6 text-purple-300" />
            </div>
            <div>
              <CardTitle className="text-white text-xl">🎯 Roth Conversion Opportunity</CardTitle>
              <CardDescription className="text-purple-200">
                You may benefit from strategic Roth conversions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eligibility.userEligible && (
                <div className="bg-gray-800/30 rounded-lg p-4 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-200">Your Eligibility</span>
                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30">✓ Eligible</Badge>
                  </div>
                  <div className="space-y-1 text-sm text-gray-300">
                    <div>Age: {eligibility.userAge} years</div>
                    <div>Tax-Deferred Assets: {formatCurrency(eligibility.userAssets)}</div>
                  </div>
                </div>
              )}
              
              {eligibility.spouseEligible && userProfile?.spouseName && (
                <div className="bg-gray-800/30 rounded-lg p-4 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-200">{userProfile.spouseName}'s Eligibility</span>
                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30">✓ Eligible</Badge>
                  </div>
                  <div className="space-y-1 text-sm text-gray-300">
                    <div>Age: {eligibility.spouseAge} years</div>
                    <div>Tax-Deferred Assets: {formatCurrency(eligibility.spouseAssets)}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
              <h4 className="text-blue-200 font-medium mb-2">Why Consider Roth Conversions?</h4>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Convert traditional retirement funds to tax-free Roth accounts</li>
                <li>• Pay taxes now at potentially lower rates than in retirement</li>
                <li>• Eliminate required minimum distributions (RMDs)</li>
                <li>• Create tax-free legacy for heirs</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button 
                onClick={() => setActiveTab("ai-roth-insights")}
                className="bg-purple-600 hover:bg-purple-700 text-white flex-1"
              >
                <Calculator className="mr-2 h-4 w-4" />
                Explore Roth Conversions
              </Button>
              <Button 
                variant="outline" 
                className="border-purple-500/30 text-purple-200 hover:bg-purple-500/10"
              >
                Learn More
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };
  
  const handleStartNewAnalysis = async () => {
    // Reset all state
    setUploadedFile(null);
    setIncomeChange("same");
    setIncomeChangeDetails("");
    setDeductionChange("same");
    setDeductionChangeDetails("");
    setAnalysisComplete(false);
    setActiveTab("upload");
    
    // Clear cached tax analysis data for the current user
    await queryClient.removeQueries({ queryKey: ["taxAnalysisResult", user?.id] });
    await queryClient.removeQueries({ queryKey: ["taxRecommendations", user?.id] });
  };

  // Determine if self-employed tab should be shown
  const showSelfEmployedTab = selfEmploymentEligibility?.isSelfEmploymentEligible;
  
  // Handle graceful redirect when self-employed tab becomes unavailable
  useEffect(() => {
    // If currently on self-employed tab but it's no longer eligible, redirect to upload tab
    if (activeTab === 'self-employed' && !isLoadingSelfEmploymentEligibility && !showSelfEmployedTab) {
      setActiveTab('upload');
    }
  }, [activeTab, showSelfEmployedTab, isLoadingSelfEmploymentEligibility]);
  
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <Card className="mb-6 bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Receipt className="h-8 w-8 text-blue-300" />
            <div>
              <CardTitle className="text-2xl text-white">Tax Strategies Center</CardTitle>
              <CardDescription className="text-gray-400">
                Upload your tax return and discover strategies to reduce your tax bill
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full ${showSelfEmployedTab ? 'grid-cols-3' : 'grid-cols-2'} bg-gray-800/50`}>
          <TabsTrigger 
            value="upload"
            className="data-[state=active]:bg-[#8A00C4] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[#8A00C4]/20 bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-600 transition-all duration-200"
          >
            Tax Insights
          </TabsTrigger>
          <TabsTrigger 
            value="ai-roth-insights"
            className="data-[state=active]:bg-[#8A00C4] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[#8A00C4]/20 bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-600 transition-all duration-200"
          >
            Roth Conversion Center
          </TabsTrigger>
          {/* Conditionally render self-employed tab based on eligibility */}
          {showSelfEmployedTab && (
            <TabsTrigger 
              value="self-employed"
              className="data-[state=active]:bg-[#8A00C4] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[#8A00C4]/20 bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-600 transition-all duration-200"
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0v2a2 2 0 01-2 2H10a2 2 0 01-2-2V6m8 0H8" />
                </svg>
                Self-Employed Strategies
              </div>
            </TabsTrigger>
          )}
        </TabsList>


        <TabsContent value="upload" className="space-y-6">
          {!showRecommendations ? (
            <>
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Step 1: Optional: Upload Your Tax Return</CardTitle>
                  <CardDescription className="text-gray-400">
                    Upload your previous year's tax return (Form 1040) as a PDF file
                  </CardDescription>
                </CardHeader>
                <CardContent>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center bg-gray-700/30">
                  <FileUp className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="text-sm text-gray-300">
                      Drop your tax return PDF here or{" "}
                      <span className="text-blue-300 font-medium hover:text-blue-200">browse</span>
                    </span>
                    <input
                      id="file-upload"
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  {uploadedFile && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <FileText className="h-5 w-5 text-green-400" />
                      <span className="text-sm text-green-400 font-medium">
                        {uploadedFile.name}
                      </span>
                    </div>
                  )}
                </div>
                <Alert className="bg-blue-500/10 border-blue-500/20">
                  <Info className="h-4 w-4 text-blue-300" />
                  <AlertDescription className="text-gray-300">
                    Your tax return will be securely analyzed using AI to identify tax-saving opportunities.
                    All data is encrypted and confidential.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Step 2: Tell Us About Expected Changes</CardTitle>
              <CardDescription className="text-gray-400">
                Help us provide more accurate recommendations by sharing expected changes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-base font-medium text-gray-200">
                  How do you expect your income to change this year?
                </Label>
                <RadioGroup value={incomeChange} onValueChange={setIncomeChange}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="increase" id="income-increase" />
                    <Label htmlFor="income-increase" className="text-gray-300">Increase</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="decrease" id="income-decrease" />
                    <Label htmlFor="income-decrease" className="text-gray-300">Decrease</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="same" id="income-same" />
                    <Label htmlFor="income-same" className="text-gray-300">Stay about the same</Label>
                  </div>
                </RadioGroup>
                {incomeChange !== "same" && (
                  <Textarea
                    placeholder="Please describe the expected change (e.g., new job, salary increase, business income change)"
                    value={incomeChangeDetails}
                    onChange={(e) => setIncomeChangeDetails(e.target.value)}
                    className="mt-2 bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                  />
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium text-gray-200">
                  How do you expect your deductions to change this year?
                </Label>
                <RadioGroup value={deductionChange} onValueChange={setDeductionChange}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="increase" id="deduction-increase" />
                    <Label htmlFor="deduction-increase" className="text-gray-300">Increase</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="decrease" id="deduction-decrease" />
                    <Label htmlFor="deduction-decrease" className="text-gray-300">Decrease</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="same" id="deduction-same" />
                    <Label htmlFor="deduction-same" className="text-gray-300">Stay about the same</Label>
                  </div>
                </RadioGroup>
                {deductionChange !== "same" && (
                  <Textarea
                    placeholder="Please describe the expected change (e.g., mortgage paid off, new home purchase, charitable giving plans)"
                    value={deductionChangeDetails}
                    onChange={(e) => setDeductionChangeDetails(e.target.value)}
                    className="mt-2 bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                  />
                )}
              </div>

              <Button
                onClick={handleAnalyze}
                disabled={analyzeTaxReturnMutation.isPending}
                className="w-full"
                size="lg"
              >
                {analyzeTaxReturnMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {uploadedFile ? 'Analyzing Your Tax Return' : 'Analyzing Your Financial Data'}... {Math.floor(analysisTimer / 60)}:{(analysisTimer % 60).toString().padStart(2, '0')}
                  </>
                ) : (
                  <>
                    <Calculator className="mr-2 h-4 w-4" />
                    {uploadedFile ? 'Analyze My Tax Return' : 'Generate Tax Insights'}
                  </>
                )}
              </Button>
              
              {analyzeTaxReturnMutation.isPending && (
                <div className="mt-4 space-y-2">
                  <Progress value={Math.min((analysisTimer / 45) * 100, 95)} className="h-2" />
                  <p className="text-sm text-gray-400 text-center">
                    {analysisTimer < 10 && "Extracting data from your tax return..."}
                    {analysisTimer >= 10 && analysisTimer < 20 && "Analyzing tax brackets and deductions..."}
                    {analysisTimer >= 20 && analysisTimer < 30 && "Identifying tax-saving opportunities..."}
                    {analysisTimer >= 30 && analysisTimer < 40 && "Calculating potential savings..."}
                    {analysisTimer >= 40 && "Finalizing recommendations..."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
            </>
          ) : (
            <>
              {/* Tax Overview Section */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Calculator className="w-5 h-5" />
                        Your Tax Overview
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Current tax year projections based on your financial profile
                      </CardDescription>
                    </div>
                    {!uploadedFile && (
                      <Button
                        onClick={() => setShowRecommendations(false)}
                        variant="outline"
                        size="sm"
                        className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        <FileUp className="mr-2 h-4 w-4" />
                        Upload Tax Return
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <TaxOverview />
                </CardContent>
              </Card>

              {/* Tax Recommendations Section */}
              {(isLoadingRecommendations || (taxRecommendations && taxRecommendations.recommendations)) && (
                <>
                  {isLoadingRecommendations ? (
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardContent className="py-16">
                        <div className="text-center">
                          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-300" />
                          <p className="mt-4 text-gray-300">Generating your tax insights...</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : taxRecommendations && taxRecommendations.recommendations ? (
                    <>
                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-white">
                            <DollarSign className="h-5 w-5 text-green-400" />
                            Your Tax Savings Overview
                          </CardTitle>
                          <CardDescription className="text-gray-400">
                            Estimated annual savings from implementing these strategies
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center">
                              <div className="text-3xl font-bold text-green-400">
                                {formatCurrency(taxRecommendations.totalEstimatedSavings || 0)}
                              </div>
                              <p className="text-sm text-gray-400 mt-1">Total Potential Annual Savings</p>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-medium text-blue-300">
                                {taxRecommendations.recommendations.length} Recommendations
                              </div>
                              <p className="text-sm text-gray-400 mt-1">
                                Priority: {taxRecommendations.priority || 'High'}
                              </p>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-medium text-purple-300">
                                {taxRecommendations.effectiveTaxRate || analysisResult?.effectiveTaxRate || 0}% Effective Rate
                              </div>
                              <p className="text-sm text-gray-400 mt-1">Current Tax Rate</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-white">
                            <TrendingDown className="h-5 w-5 text-green-400" />
                            Top {Math.min(5, taxRecommendations.recommendations.length)} Tax Reduction Strategies
                          </CardTitle>
                          <CardDescription className="text-gray-400">
                            Ranked by urgency and potential impact
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {taxRecommendations.recommendations
                              .sort((a, b) => (b.urgency || 0) - (a.urgency || 0))
                              .slice(0, 5)
                              .map((recommendation, index) => (
                              <Card key={index} className="border-l-4 border-l-green-400 bg-gray-700/30 border-gray-600">
                                <CardHeader>
                                  <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <Badge 
                                          variant="outline" 
                                          className={`font-mono ${
                                            (recommendation.urgency || 0) >= 8 ? 'text-red-400 border-red-400/50' :
                                            (recommendation.urgency || 0) >= 6 ? 'text-yellow-400 border-yellow-400/50' :
                                            'text-green-400 border-green-400/50'
                                          }`}
                                        >
                                          #{index + 1} - {(recommendation.urgency || 0) >= 8 ? 'High' : (recommendation.urgency || 0) >= 6 ? 'Medium' : 'Low'} Urgency
                                        </Badge>
                                        <CardTitle className="text-lg text-white">{recommendation.title}</CardTitle>
                                      </div>
                                      <CardDescription className="text-gray-300">{recommendation.description}</CardDescription>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-lg font-bold text-green-400">
                                        {formatCurrency(recommendation.estimatedSavings || recommendation.estimatedAnnualSavings || 0)}
                                      </div>
                                      <p className="text-xs text-gray-400">Annual Savings</p>
                                      {recommendation.implementationTimeframe && (
                                        <p className="text-xs text-gray-400 mt-1">{recommendation.implementationTimeframe}</p>
                                      )}
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    <div>
                                      <p className="text-sm font-medium text-gray-200 mb-2">Action Items:</p>
                                      <ul className="space-y-1">
                                        {(recommendation.actionItems || recommendation.implementation || []).map((item, itemIndex) => (
                                          <li key={itemIndex} className="flex items-start gap-2 text-sm text-gray-300">
                                            <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                                            <span>{item}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                    
                                    {recommendation.requirements && recommendation.requirements.length > 0 && (
                                      <div>
                                        <p className="text-sm font-medium text-gray-200 mb-2">Requirements:</p>
                                        <ul className="space-y-1">
                                          {recommendation.requirements.map((req, reqIndex) => (
                                            <li key={reqIndex} className="flex items-start gap-2 text-sm text-gray-400">
                                              <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                              <span>{req}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    
                                    {recommendation.deadline && (
                                      <div className="flex items-center gap-2 text-sm text-orange-400">
                                        <AlertCircle className="h-4 w-4" />
                                        <span><strong>Deadline:</strong> {recommendation.deadline}</span>
                                      </div>
                                    )}
                                    
                                    {recommendation.risks && (
                                      <Alert className="bg-yellow-500/10 border-yellow-500/20 mt-3">
                                        <AlertCircle className="h-4 w-4 text-yellow-400" />
                                        <AlertDescription className="text-gray-300 text-sm">
                                          <strong>Considerations:</strong> {recommendation.risks}
                                        </AlertDescription>
                                      </Alert>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Alert className="bg-yellow-500/10 border-yellow-500/20">
                        <AlertCircle className="h-4 w-4 text-yellow-400" />
                        <AlertDescription className="text-gray-300">
                          <strong>Important Tax Compliance Disclaimer:</strong> These insights are for educational purposes only and are based on current IRS guidelines and your specific tax situation. 
                          This information does not constitute professional tax advice, legal advice, or financial planning recommendations. 
                          Tax laws are complex and subject to change. Individual circumstances vary significantly, and what may be beneficial for one taxpayer may not be appropriate for another.
                          Please consult with a qualified tax professional, CPA, or enrolled agent before implementing any tax strategies. 
                          Always verify current tax laws and regulations with official IRS publications or professional advisors before making any financial decisions.
                        </AlertDescription>
                      </Alert>

                      {/* Roth Conversion Tile */}
                      <RothConversionTile />
                    </>
                  ) : null}
                </>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="ai-roth-insights" className="space-y-6">
          {/* Roth Conversion Primer */}
          <Card className="bg-gradient-to-r from-blue-950 to-purple-950 border-blue-500/50">
            <CardHeader>
              <CardTitle 
                className="text-white text-xl flex items-center justify-between cursor-pointer hover:bg-white/5 rounded p-2 -m-2 transition-colors"
                onClick={() => setShowRothPrimer(!showRothPrimer)}
              >
                <div className="flex items-center">
                  <Info className="h-6 w-6 mr-2 text-blue-300" />
                  What is Roth Conversion?
                </div>
                {showRothPrimer ? 
                  <ChevronUp className="h-5 w-5 text-gray-400" /> : 
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                }
              </CardTitle>
            </CardHeader>
            {showRothPrimer && (
              <CardContent>
                <div className="text-gray-200 space-y-3">
                  <p>
                    A Roth conversion shifts money from tax‑deferred accounts into a Roth, letting you pay tax now so every future dollar grows and comes out tax‑free.
                  </p>
                  <p>
                    This <strong>tax arbitrage</strong> locks in today's (often lower) rate, trims future Required Minimum Distributions, and can keep Medicare IRMAA surcharges and Social Security taxation down.
                  </p>
                  <p>
                    Your best shot is the post‑retirement, pre‑Social Security "golden window," where you purposely "fill" the 12%‑22% brackets each year while income is low.
                  </p>
                  <p>
                    Done methodically, conversions create lifetime tax‑free spending power and a legacy of tax‑free wealth for heirs.
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {(() => {
            // NEW: Use optimization variables as primary data source with intake form fallback
            const optimizationVars = userProfile?.optimizationVariables;
            const hasLockedOptimizationVars = optimizationVars?.isLocked && optimizationVars?.lockedAt;
            
            // Defensive programming: validate optimization variables have required fields
            const hasValidOptimizationVars = hasLockedOptimizationVars && 
              optimizationVars.retirementAge && 
              optimizationVars.socialSecurityAge;
            
            // Priority: Optimization Variables > Intake Form Data (fallback)
            const retirementAge = hasValidOptimizationVars ? 
              optimizationVars.retirementAge : (userProfile?.desiredRetirementAge || userProfile?.retirementAge);
            const socialSecurityClaimAge = hasValidOptimizationVars ? 
              optimizationVars.socialSecurityAge : (userProfile?.socialSecurityClaimAge || 67);
            const spouseRetirementAge = hasValidOptimizationVars ? 
              optimizationVars.spouseRetirementAge : userProfile?.spouseDesiredRetirementAge;
            const spouseSocialSecurityClaimAge = hasValidOptimizationVars ? 
              optimizationVars.spouseSocialSecurityAge : (userProfile?.spouseSocialSecurityClaimAge || 67);
            
            // Calculate current ages using the global calculateAge function
            const currentUserAge = calculateAge(userProfile?.dateOfBirth || '');
            const currentSpouseAge = calculateAge(userProfile?.spouseDateOfBirth || '');
            
            // NEW: Age 50+ qualification check
            const userMeetsAgeRequirement = currentUserAge >= 50;
            const spouseMeetsAgeRequirement = currentSpouseAge >= 50;
            const anyoneMeetsAgeRequirement = userMeetsAgeRequirement || spouseMeetsAgeRequirement;
            
            // Calculate tax-deferred assets
            const assets = userProfile?.assets || [];
            const taxDeferredTypes = ['401k', '403b', 'traditional-ira', 'other-tax-deferred', 'hsa', 'qualified-annuities'];
            
            // Calculate total tax-deferred assets for user (case-insensitive owner matching)
            const userTaxDeferredAssets = assets
              .filter((asset: any) => 
                taxDeferredTypes.includes(asset.type?.toLowerCase()) && 
                (asset.owner?.toLowerCase() === 'user' || asset.owner?.toLowerCase() === 'self') &&
                parseFloat(asset.value?.toString() || '0') > 0
              )
              .reduce((total: number, asset: any) => total + (parseFloat(asset.value?.toString() || '0') || 0), 0);
            
            // Calculate total tax-deferred assets for spouse (case-insensitive owner matching)  
            const spouseTaxDeferredAssets = assets
              .filter((asset: any) => 
                taxDeferredTypes.includes(asset.type?.toLowerCase()) && 
                asset.owner?.toLowerCase() === 'spouse' &&
                parseFloat(asset.value?.toString() || '0') > 0
              )
              .reduce((total: number, asset: any) => total + (parseFloat(asset.value?.toString() || '0') || 0), 0);
            
            const userHasTaxDeferredAssets = userTaxDeferredAssets > 0;
            const spouseHasTaxDeferredAssets = spouseTaxDeferredAssets > 0;
            
            // Golden Window Tests
            const userGapYears = socialSecurityClaimAge && retirementAge ? socialSecurityClaimAge - retirementAge : 0;
            const spouseGapYears = spouseSocialSecurityClaimAge && spouseRetirementAge ? spouseSocialSecurityClaimAge - spouseRetirementAge : 0;
            
            const userPassesGapTest = userGapYears > 0;
            const spousePassesGapTest = spouseGapYears > 0;
            
            // 3-Year Planning Window Tests
            const userYearsToRetirement = retirementAge && currentUserAge ? retirementAge - currentUserAge : 0;
            const spouseYearsToRetirement = spouseRetirementAge && currentSpouseAge ? spouseRetirementAge - currentSpouseAge : 0;
            
            const userPasses3YearTest = userHasTaxDeferredAssets && userYearsToRetirement <= 3 && userYearsToRetirement >= 0;
            const spousePasses3YearTest = spouseHasTaxDeferredAssets && spouseYearsToRetirement <= 3 && spouseYearsToRetirement >= 0;
            
            // UPDATED: Simplified logic - Age 50+ AND gap years only (3-year planning window removed)
            // READY: Age 50+ AND has gap years (golden window opportunity)
            // NOT READY: Under age 50 OR no gap years
            const anyoneHasGapYears = userPassesGapTest || spousePassesGapTest;
            const anyonePassesAllTests = anyoneMeetsAgeRequirement && anyoneHasGapYears;
            
            // For backward compatibility with existing UI, keep the partial logic but simplified
            const anyonePassesAnyTest = anyonePassesAllTests; // Same as all tests now since we removed 3-year requirement
            
            // Create visual indicators and recommendations based on results
            const getOverallResult = () => {
              const yearsToRetirement = Math.min(userYearsToRetirement, spouseYearsToRetirement);
              const isWithin3Years = yearsToRetirement <= 3 && yearsToRetirement >= 0;
              
              // NEW: Check age requirement first
              if (!anyoneMeetsAgeRequirement) {
                return {
                  status: "NOT READY",
                  color: "text-orange-400",
                  bgColor: "bg-orange-900/30",
                  borderColor: "border-orange-500/50",
                  icon: AlertCircle,
                  description: "Age requirement not met",
                  actionItems: [
                    "🎂 Age Requirement: Roth conversions are most beneficial for individuals age 50 and above",
                    "💰 Why Age 50+? You need sufficient time for the converted funds to grow tax-free before retirement",
                    "📈 Continue building retirement savings: Focus on maximizing 401k/403b/IRA contributions for now",
                    "⏳ Check back when you reach age 50: Roth conversion analysis will unlock automatically",
                    "🏡 Estate Planning: Even without optimal timing, consider Roth conversions later for tax-free inheritance"
                  ]
                };
              }
              
              // NEW: Check optimization variables requirement
              if (!hasValidOptimizationVars) {
                return {
                  status: "NOT READY",
                  color: "text-purple-400", 
                  bgColor: "bg-purple-900/30",
                  borderColor: "border-purple-500/50",
                  icon: AlertCircle,
                  description: "Complete retirement optimization first",
                  actionItems: [
                    "🎯 Required: Complete and lock your retirement optimization variables first",
                    "📊 Why? Roth conversions require your optimized retirement timeline and projected account balances",
                    "✅ Next Steps: Visit Retirement Planning → Optimization tab to set and lock your variables",
                    "🔒 Lock your variables: This ensures consistent data across all tax strategy analyses",
                    "🔄 Return here: Once locked, this analysis will unlock automatically"
                  ]
                };
              }
              
              if (anyonePassesAllTests) {
                return {
                  status: "READY",
                  color: "text-emerald-400",
                  bgColor: "bg-emerald-900/30",
                  borderColor: "border-emerald-500/50",
                  icon: CheckCircle,
                  description: "You're ready for strategic Roth conversion planning!",
                  actionItems: [
                    `✨ Golden Window Explained: You have ${Math.max(userGapYears, spouseGapYears)} years between retirement and Social Security - this is your golden window to convert retirement funds to tax-free Roth accounts at lower tax rates`,
                    "🤖 Get AI-powered conversion strategy recommendations below to see exactly how much to convert each year",
                    `👨‍💼 Start working with a tax professional to implement your conversion plan - you can begin planning now at age 50+`,
                    "💰 Build cash reserves in regular savings/investment accounts to pay the taxes on conversions (never use retirement money to pay conversion taxes)"
                  ]
                };
              } else {
                return {
                  status: "NOT READY",
                  color: "text-slate-400",
                  bgColor: "bg-slate-800/30", 
                  borderColor: "border-slate-500/50",
                  icon: XCircle,
                  description: "Consider adjusting your retirement timeline",
                  actionItems: [
                    "❓ What is the Golden Window? The years between when you retire and when you start Social Security - during this time you can convert traditional retirement accounts to tax-free Roth accounts at lower tax rates",
                    "🎯 Create Golden Window: Consider retiring 1-2 years earlier OR delaying Social Security to age 67-70 for higher monthly benefits", 
                    "💪 Build retirement savings: Increase contributions to 401k/403b/traditional IRA - you need significant tax-deferred assets to make conversions worthwhile",
                    `👨‍💼 Meet with a financial advisor ${yearsToRetirement > 0 && yearsToRetirement <= 5 ? 'soon' : 'as retirement approaches'} to reassess your overall retirement strategy`,
                    "🏡 Estate Planning Benefit: Even without optimal timing, Roth conversions create tax-free inheritance for your heirs"
                  ]
                };
              }
            };

            const result = getOverallResult();
            const ResultIcon = result.icon;

            return (
              <>
                
                {/* Roth Conversion Readiness Assessment removed */}


                {/* AI Analysis Section */}
                <Card className="bg-gray-900/50 border-gray-700">
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Brain className="h-6 w-6 text-[#8A00C4]" />
                      <CardTitle className="text-white">Roth Conversion Strategy Analysis</CardTitle>
                    </div>
                    <CardDescription className="text-gray-400">
                      Get Roth conversion recommendations based on your complete financial profile using advanced analysis.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {!aiAnalysisResult && !isAnalyzing && !analysisError && (
                <div className="text-center py-8">
                  <div className="mb-4">
                    <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-2" />
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Roth Conversion Strategy Analysis
                    </h3>
                    <p className="text-gray-400 mb-6 max-w-md mx-auto">
                      Run a personalized analysis of potential lifetime tax savings and estate impacts from strategic Roth conversions.
                    </p>
                  </div>
                  <Button 
                    onClick={handleAIAnalysis}
                    disabled={isAnalyzing || aiRothAnalysisMutation.isPending}
                    className="bg-[#8A00C4] hover:bg-[#7A00B4] text-white px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    size="lg"
                  >
                    <Brain className="h-5 w-5 mr-2" />
                    Analyze Roth Conversion Benefits
                  </Button>
                </div>
              )}

              {(isAnalyzing || isLoadingStoredRoth) && (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-[#8A00C4] mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">Analyzing Your Financial Profile</h3>
                  <p className="text-gray-400">
                    Performing comprehensive analysis of your Roth conversion options...
                  </p>
                </div>
              )}

              {analysisError && (
                <Alert className="border-red-500 bg-red-900/20">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-300">
                    {analysisError}
                  </AlertDescription>
                </Alert>
              )}

              {aiAnalysisResult && !isAnalyzing && (
                <div className="space-y-6">
                  {/* Current Situation Overview */}
                  <Card className="bg-gray-800/50 border-gray-600">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center">
                        <Info className="h-5 w-5 mr-2 text-blue-400" />
                        Current Financial Situation
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-300 mb-4">{aiAnalysisResult.analysis?.currentSituation}</p>
                      <div className="space-y-2">
                        <h4 className="font-medium text-white">Key Considerations:</h4>
                        <ul className="space-y-1">
                          {aiAnalysisResult.analysis?.keyConsiderations?.map((consideration, index) => (
                            <li key={index} className="text-gray-300 text-sm flex items-start">
                              <span className="text-[#8A00C4] mr-2">•</span>
                              {consideration}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Strategy Benefits Tiles */}
                  {(() => {
                    // Find the recommended strategy data
                    const recommendedStrategy = aiAnalysisResult.strategies.find(
                      strategy => strategy.name === aiAnalysisResult.recommendation.selectedStrategy
                    );
                    
                    if (!recommendedStrategy) return null;
                    
                    // Calculate values
                    const lifetimeTaxSavings = Math.abs(
                      aiAnalysisResult.baselineScenario.projections.lifetimeIncomeTaxes - 
                      recommendedStrategy.projections.lifetimeIncomeTaxes
                    );
                    
                    const estateValueBenefit = Math.abs(
                      recommendedStrategy.projections.afterTaxEstateValueAt85 - 
                      aiAnalysisResult.baselineScenario.projections.afterTaxEstateValueAt85
                    );
                    
                    // Calculate total upfront taxes for next 5 years
                    const totalUpfrontTaxes = aiAnalysisResult.recommendation.implementationPlan?.nextFiveYears?.reduce(
                      (sum, year) => sum + (year.taxOwed || 0), 0
                    ) || 0;
                    
                    // Simplified liquidity check - assume they have enough taxable assets if total conversions exist
                    const hasLiquidity = totalUpfrontTaxes > 0 && totalUpfrontTaxes < 500000; // Basic check
                    
                    // Generate recommendation rating
                    const getRating = () => {
                      if (lifetimeTaxSavings > 100000 && estateValueBenefit > 200000 && hasLiquidity) {
                        return { rating: "CONVERT NOW", color: "text-green-400", bgColor: "from-green-900/40 to-green-800/30", borderColor: "border-green-600/40", description: "Excellent opportunity with significant benefits" };
                      } else if (lifetimeTaxSavings > 50000 && estateValueBenefit > 100000) {
                        return { rating: "CONVERT", color: "text-green-300", bgColor: "from-green-900/30 to-green-800/20", borderColor: "border-green-600/30", description: "Good opportunity with solid benefits" };
                      } else if (lifetimeTaxSavings > 25000 || estateValueBenefit > 50000) {
                        return { rating: "CONSIDER CONVERTING", color: "text-yellow-300", bgColor: "from-yellow-900/30 to-yellow-800/20", borderColor: "border-yellow-600/30", description: "Moderate benefits, analyze carefully" };
                      } else {
                        return { rating: "DO NOT CONVERT", color: "text-orange-300", bgColor: "from-orange-900/30 to-orange-800/20", borderColor: "border-orange-600/30", description: "Limited benefits or poor timing" };
                      }
                    };
                    
                    const rating = getRating();
                    
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        {/* Lifetime Tax Savings Tile */}
                        <Card className="bg-gradient-to-r from-green-950 to-green-800 border-2 border-green-400/40 shadow-xl shadow-green-400/20 backdrop-blur-sm">
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center">
                                <DollarSign className="h-7 w-7 text-green-300 mr-3" />
                                <h3 className="text-sm font-semibold text-green-100">Lifetime Tax Savings</h3>
                              </div>
                              <Badge className="bg-green-950/60 text-green-200 border-green-400/30 font-medium">
                                vs No Conversion
                              </Badge>
                            </div>
                            <div className="text-4xl font-bold text-green-50 mb-3">
                              ${Math.round(lifetimeTaxSavings).toLocaleString()}
                            </div>
                            <p className="text-sm text-green-200">
                              Total taxes saved over your lifetime compared to no Roth conversions
                            </p>
                          </CardContent>
                        </Card>

                        {/* Estate Value Tile */}
                        <Card className="bg-gradient-to-r from-blue-950 to-blue-800 border-2 border-blue-400/40 shadow-xl shadow-blue-400/20 backdrop-blur-sm">
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center">
                                <PiggyBank className="h-7 w-7 text-blue-300 mr-3" />
                                <h3 className="text-sm font-semibold text-blue-100">Estate Value Increase</h3>
                              </div>
                              <Badge className="bg-blue-950/60 text-blue-200 border-blue-400/30 font-medium">
                                vs No Conversion
                              </Badge>
                            </div>
                            <div className="text-4xl font-bold text-blue-50 mb-3">
                              ${Math.round(estateValueBenefit).toLocaleString()}
                            </div>
                            <p className="text-sm text-blue-200">
                              Additional after-tax value for heirs with recommended strategy
                            </p>
                          </CardContent>
                        </Card>

                        {/* Recommendation Tile */}
                        <Card className="bg-gradient-to-r from-purple-950 to-purple-800 border-2 border-[#8A00C4]/40 shadow-xl shadow-purple-400/20 backdrop-blur-sm">
                          <CardContent className="p-6">
                            <div className={`text-3xl font-bold mb-3 mt-4 ${rating.color}`}>
                              {rating.rating}
                            </div>
                            <p className="text-sm text-purple-200 mb-3">
                              {rating.description}
                            </p>
                            <div className="flex items-center text-xs text-purple-300">
                              <Info className="h-4 w-4 mr-1" />
                              Consult a tax professional at retirement.
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })()}

                  {/* Implementation Plan - 5 Year Conversion Schedule */}
                  {aiAnalysisResult.recommendation?.implementationPlan?.nextFiveYears && 
                   aiAnalysisResult.recommendation.implementationPlan.nextFiveYears.length > 0 && (
                    <Card className="bg-gray-800/50 border-gray-600">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white flex items-center">
                          <Target className="h-5 w-5 mr-2 text-[#8A00C4]" />
                          5-Year Roth Conversion Plan
                        </CardTitle>
                        <div className="flex items-center gap-3">
                          {lastCalculatedAt && (
                            <span className="text-xs text-gray-400">
                              Last calculated: {new Date(lastCalculatedAt).toLocaleString()}
                            </span>
                          )}
                          <Button
                            variant="outline"
                            size="icon"
                            className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                            onClick={handleAIAnalysis}
                            disabled={isAnalyzing || aiRothAnalysisMutation.isPending}
                            title="Recalculate analysis"
                          >
                            {isAnalyzing || aiRothAnalysisMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {aiAnalysisResult.recommendation.implementationPlan.nextFiveYears.map((year, index) => (
                            <Card key={index} className="bg-gray-700/50 border-gray-600">
                              <CardContent className="pt-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <p className="text-sm text-gray-400">Year {year.year} (Age {year.age})</p>
                                    <p className="text-lg font-semibold text-white">
                                      ${Math.round(year.conversionAmount).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-gray-400">Conversion Amount</p>
                                  </div>
                                  <div>
                                    <p className="text-lg font-semibold text-orange-400">
                                      ${Math.round(year.taxOwed).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-gray-400">Tax Owed</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-green-400">{year.taxPaymentSource}</p>
                                    <p className="text-xs text-gray-400">Payment Source</p>
                                  </div>
                                </div>
                                <div className="mt-3">
                                  <h5 className="text-sm font-medium text-white mb-1">Actions:</h5>
                                  <ul className="space-y-1">
                                    {year.actions?.map((action, actionIndex) => (
                                      <li key={actionIndex} className="text-xs text-gray-300">
                                        <CheckCircle className="h-3 w-3 inline mr-1 text-green-400" />
                                        {action}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Disclaimer */}
                  <Alert className="border-yellow-500 bg-yellow-900/20">
                    <Info className="h-4 w-4 text-yellow-400" />
                    <AlertDescription className="text-yellow-200">
                      {aiAnalysisResult.disclaimer}
                    </AlertDescription>
                  </Alert>

                  {/* Action Button */}
                  <div className="text-center">
                    <Button 
                      onClick={handleAIAnalysis}
                      disabled={isAnalyzing || aiRothAnalysisMutation.isPending}
                      className="bg-purple-600 hover:bg-purple-700 text-white border border-purple-500 hover:border-purple-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-600 disabled:border-gray-500 disabled:text-gray-300 transition-all duration-200 shadow-lg hover:shadow-purple-500/30"
                    >
                      <Brain className="h-4 w-4 mr-2" />
                      Run New Analysis
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
                </Card>
            </>
          );
        })()}

        </TabsContent>
        
        {/* Self-Employed Tab - Conditionally rendered based on employment status */}
        {showSelfEmployedTab && (
          <TabsContent value="self-employed" className="space-y-6">
            <SelfEmployedStrategiesTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// Main exported component with gamification wrapper
export function TaxReductionCenter() {
  const { user } = useAuth();

  return (
    <TaxGamification userId={user?.id || null}>
      <TaxReductionCenterContent />
    </TaxGamification>
  );
}
