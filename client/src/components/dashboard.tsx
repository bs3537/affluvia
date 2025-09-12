import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gauge } from "@/components/ui/gauge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MetricDisplay } from "@/components/ui/metric-display";
import { RiskProfileIndicator } from "@/components/ui/risk-profile-indicator";
import { RecommendationAccordion } from "@/components/ui/recommendation-accordion";
import { ValueTeaserCard, ValueTeaserInline } from "@/components/ui/value-teaser-card";
import ComprehensiveInsightsSection from "@/components/comprehensive-insights-section";
import { 
  Heart, 
  DollarSign, 
  TrendingUp, 
  Umbrella, 
  PiggyBank, 
  Shield,
  Lightbulb,
  ArrowUp,
  AlertTriangle,
  Trash2,
  User,
  Target,
  PieChart as PieChartIcon,
  Edit3,
  Settings,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  ChevronRight,
  Building2
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { QuickEditModal } from "@/components/quick-edit-modal";
import { RetirementSuccessAuto } from "@/components/retirement-success-auto";
import { RetirementConfidenceEnhancedBands } from "@/components/widgets/retirement-confidence-enhanced-bands";
import { NetWorthWidgetV2 } from "@/components/net-worth-widget-v2";
import { CashFlowWidgetV2 } from "@/components/cash-flow-widget-v2";
import { LastCalculated } from "@/components/ui/last-calculated";
import { useDashboardSnapshot, pickWidget } from "@/hooks/useDashboardSnapshot";
// Removed recommendations component: FinancialHealthSuggestions

// Add CSS animations for smooth expand/collapse
const expandCollapseStyles = `
  .expand-content {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }
  
  .expand-content.collapsed {
    max-height: 0;
    opacity: 0;
    transform: translateY(-8px);
  }
  
  .expand-content.expanded {
    max-height: 500px;
    opacity: 1;
    transform: translateY(0);
  }
  
  .chevron-icon {
    transition: transform 0.2s ease-in-out;
  }
  
  .chevron-icon.rotated {
    transform: rotate(180deg);
  }
  
  .expand-toggle-btn {
    transition: all 0.2s ease-in-out;
    position: relative;
  }
  
  .expand-toggle-btn:hover {
    background-color: rgba(176, 64, 255, 0.2) !important;
    transform: scale(1.1);
    box-shadow: 0 0 15px rgba(176, 64, 255, 0.3);
  }
  
  .expand-toggle-btn:hover .chevron-icon {
    color: #B040FF !important;
    transform: scale(1.1);
  }
  
  .expand-toggle-btn:hover .chevron-icon.rotated {
    transform: rotate(180deg) scale(1.1);
  }
  
  .expand-toggle-btn::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    background: linear-gradient(45deg, #B040FF, #7C3AED);
    border-radius: 8px;
    opacity: 0;
    transition: opacity 0.2s ease-in-out;
    z-index: -1;
  }
  
  .expand-toggle-btn:hover::before {
    opacity: 0.2;
  }
  
  .widget-card {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }
  
  .widget-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, #B040FF, transparent);
    transform: translateX(-100%);
    transition: transform 0.6s ease;
  }
  
  .widget-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(176, 64, 255, 0.2);
  }
  
  .widget-card:hover::before {
    transform: translateX(100%);
  }
`;

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('dashboard-animations')) {
  const style = document.createElement('style');
  style.id = 'dashboard-animations';
  style.textContent = expandCollapseStyles;
  document.head.appendChild(style);
}

interface Recommendation {
  title: string;
  description: string;
  impact: string;
  category: string;
  priority: number;
  potentialImprovement: number;
  actionSteps: string[];
}

interface FinancialProfile {
  // Basic user info
  id?: number;
  userId?: number;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
  maritalStatus?: string;
  dependents?: number | null;
  spouseName?: string;
  spouseDateOfBirth?: string | null;
  state?: string | null;
  
  // Employment and income
  employmentStatus?: string | null;
  annualIncome?: number;
  takeHomeIncome?: number | null;
  otherIncome?: number | null;
  spouseEmploymentStatus?: string | null;
  spouseAnnualIncome?: number;
  spouseTakeHomeIncome?: number | null;
  
  // Financial data
  assets?: Array<{ value: number; type?: string }>;
  liabilities?: Array<{ balance: number; monthlyPayment?: number }>;
  primaryResidence?: { marketValue: number; mortgageBalance: number; monthlyPayment?: number };
  monthlyExpenses?: Record<string, number>;
  monthlyCashFlow?: number | null;
  emergencyFundSize?: number;
  
  // Retirement contributions
  retirementContributions?: any;
  spouseRetirementContributions?: any;
  traditionalIRAContribution?: number | null;
  rothIRAContribution?: number | null;
  spouseTraditionalIRAContribution?: number | null;
  spouseRothIRAContribution?: number | null;
  
  // Goals and planning
  goals?: Array<{ name: string; targetAmount: number; targetDate: string; calculatedProbability?: number }>;
  retirementAge?: number | null;
  retirementIncome?: number | null;
  
  // Risk profiles and allocations
  currentAllocation?: {
    usStocks: number;
    intlStocks: number;
    bonds: number;
    alternatives: number;
    cash: number;
  };
  spouseAllocation?: {
    usStocks: number;
    intlStocks: number;
    bonds: number;
    alternatives: number;
    cash: number;
  };
  
  // Monte Carlo simulation
  monteCarloSimulation?: any;
  
  // Calculated scores and metrics
  financialHealthScore?: number;
  netWorth?: number;
  emergencyReadinessScore?: number;
  emergencyReadinessScoreCFP?: number;
  insuranceScore?: number;
  riskManagementScore?: number;
  
  // Risk profiles
  userRiskProfile?: string;
  investor_risk_profile?: string;
  spouseRiskProfile?: string;
  spouse_risk_profile?: string;
  
  // Additional fields
  targetAllocation?: {
    usStocks: number;
    intlStocks: number;
    bonds: number;
    alternatives: number;
    cash: number;
  };
  spouseTargetAllocation?: {
    usStocks: number;
    intlStocks: number;
    bonds: number;
    alternatives: number;
    cash: number;
  };
  desiredRetirementAge?: number;
  lastUpdated?: Date | null;
  
  calculations?: {
    healthScore: number;
    netWorth: number;
    monthlyCashFlow: number;
    emergencyScore: number;
    emergencyMonths: number;
    retirementScore: number;
    retirementAssets?: number;
    recommendedRetirement?: number;
    riskManagementScore: number;
    emergencyReadinessScoreCFP: number;
    riskProfile: string;
    riskScore?: number;
    totalAssets?: number;
    totalLiabilities?: number;
    recommendations?: Recommendation[];
    targetAllocation: {
      usStocks: number;
      intlStocks: number;
      bonds: number;
      alternatives: number;
      cash: number;
    };
    spouseTargetAllocation?: {
      usStocks: number;
      intlStocks: number;
      bonds: number;
      alternatives: number;
      cash: number;
    };
    spouseRiskProfile?: string;
    spouseRiskScore?: number;
    breakdown: {
      emergencyFundScore: number;
      dtiScore: number;
      savingsRateScore: number;
      insuranceScore: number;
    };
    insuranceAdequacy?: {
      score: number;
      breakdown: Record<string, { score: number; weight: number; }>;
    };
    arrsDetails?: {
      score: number;
      components: {
        rfr: number;
        pos: number;
        incomeReplacement: number;
        expenseCoverage: number;
        longevityProtection: number;
        legacy: number;
      };
      details: {
        currentAssets: number;
        projectedAssets: number;
        fundingRatio: number;
        probabilityOfSuccess: number;
        monthlyRetirementExpenses: number;
        monthlyGuaranteedIncome: number;
        monthlyGap: number;
      };
    };
  };
}

// Helper function to check if intake form is complete
const isIntakeFormComplete = (profile: FinancialProfile): boolean => {
  // If backend marked it complete, honor that
  if ((profile as any).isComplete === true) return true;

  // Basic info
  const hasBasicInfo = !!(
    profile.firstName &&
    profile.dateOfBirth &&
    profile.state
  );

  // Financial data: income + (expenses or assets/liabilities)
  const hasIncome = Number(profile.annualIncome) > 0 || Number((profile as any).takeHomeIncome) > 0;
  const hasExpenses =
    !!profile.monthlyExpenses &&
    typeof profile.monthlyExpenses === 'object' &&
    Object.values(profile.monthlyExpenses as any).some((v: any) => Number(v) > 0);
  const hasAssetsOrDebts = (profile.assets?.length || 0) > 0 || (profile.liabilities?.length || 0) > 0;
  const hasFinancialData = hasIncome && (hasExpenses || hasAssetsOrDebts);

  // Retirement data: core selections, don't require non-zero benefit or expense estimates
  const hasRetirementData =
    Number((profile as any).desiredRetirementAge) > 0 &&
    Number((profile as any).socialSecurityClaimAge) > 0;

  return hasBasicInfo && hasFinancialData && hasRetirementData;
};

// Component for incomplete data warning
const IncompleteDataWarning = () => (
  <div className="flex items-center gap-2 px-2.5 py-1 bg-gray-800/50 border border-gray-700 rounded mb-2">
    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
    <span className="text-xs text-gray-400">
      Incomplete data
    </span>
  </div>
);

// Helper function to get priority styling
const getPriorityIcon = (priority: number) => {
  switch (priority) {
    case 1: return <AlertCircle className="w-4 h-4 text-red-400" />;
    case 2: return <Clock className="w-4 h-4 text-yellow-400" />;
    default: return <CheckCircle2 className="w-4 h-4 text-blue-400" />;
  }
};

const getPriorityLabel = (priority: number) => {
  switch (priority) {
    case 1: return "Urgent";
    case 2: return "Important"; 
    default: return "Optimal";
  }
};

const getPriorityColor = (priority: number) => {
  switch (priority) {
    case 1: return "border-red-500/30 bg-red-500/10";
    case 2: return "border-yellow-500/30 bg-yellow-500/10";
    default: return "border-blue-500/30 bg-blue-500/10";
  }
};


export function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<FinancialProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [quickEditModal, setQuickEditModal] = useState<{
    isOpen: boolean;
    editType: 'income' | 'retirement' | 'risk' | null;
  }>({ isOpen: false, editType: null });
  
  // Snapshot for instant values
  const { data: dashSnapshot } = useDashboardSnapshot();
  const snapHealth: any = pickWidget(dashSnapshot, 'financial_health');
  const snapEmergency: any = pickWidget(dashSnapshot, 'emergency_readiness');
  const snapCash: any = pickWidget(dashSnapshot, 'cash_flow');
  const snapRisk: any = pickWidget(dashSnapshot, 'risk_profile');

  
  // Progressive disclosure states for dashboard widgets
  const [expandedSections, setExpandedSections] = useState<{
    [key: string]: boolean;
  }>({
    financialHealth: false,
    cashFlow: false,
    netWorth: false,
    emergencyFund: false,
    insuranceAdequacy: false,
    monteCarloSimulation: false,
    monteCarloSimulationV2: false,
    monteCarloTrials: false
  });
  
  const { toast } = useToast();

  // Format helper for last updated
  const formatLastUpdated = (value: any) => {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  };

  // Trigger fresh recalculation and Plaid sync, then refresh local + query caches
  const refreshDashboardData = async () => {
    try {
      setIsRefreshing(true);
      await fetch(`/api/financial-profile?refresh=true&syncPlaid=true&t=${Date.now()}` , {
        credentials: 'include'
      });
      await fetchProfile();
      // Notify widgets that rely on their own fetchers to recalculate
      window.dispatchEvent(new CustomEvent('refreshDashboard'));
      await queryClient.invalidateQueries({ queryKey: ['financial-profile'] });
      await queryClient.invalidateQueries({ queryKey: ['asset-projections'] });
      toast({ title: 'Data refreshed', description: 'Dashboard metrics recalculated.' });
    } catch (e) {
      console.error('Refresh error:', e);
      toast({ title: 'Refresh failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Single source of truth for insurance score - prefer snapshot, then computed
  const insuranceScore = (typeof snapInsurance?.score === 'number')
    ? Math.round(snapInsurance.score)
    : (profile?.calculations?.insuranceAdequacy?.score ??
      profile?.calculations?.riskManagementScore ??
      profile?.calculations?.breakdown?.insuranceScore ??
      profile?.riskManagementScore ?? 0);

  // Calculate Emergency Readiness Score
  const calculateEmergencyReadinessScore = () => {
    if (!profile) return 0;
    
    // Get emergency fund size from profile or calculate from assets if not available
    let emergencyFundSize = Number(profile?.emergencyFundSize || 0);
    
    // Fallback: calculate from liquid assets if emergency fund size not set
    if (emergencyFundSize === 0 && profile?.assets) {
      emergencyFundSize = profile.assets
        .filter((asset: any) => 
          asset.type && (
            asset.type.toLowerCase().includes('emergency') ||
            asset.type.toLowerCase().includes('savings') ||
            asset.type.toLowerCase().includes('checking')
          )
        )
        .reduce((sum: number, asset: any) => sum + (Number(asset.value) || 0), 0);
    }
    
    // Calculate essential monthly expenses
    const monthlyExpenses = profile?.monthlyExpenses || {};
    const essentialExpenses = 
      (Number(monthlyExpenses.housing) || 0) +
      (Number(monthlyExpenses.food) || 0) +
      (Number(monthlyExpenses.transportation) || 0) +
      (Number(monthlyExpenses.utilities) || 0) +
      (Number(monthlyExpenses.healthcare) || 0) +
      (Number(monthlyExpenses.insurance) || 0) +
      (Number(monthlyExpenses.childcare) || 0) +
      (Number(monthlyExpenses.otherDebtPayments) || 0) +
      (Number(monthlyExpenses.householdExpenses) || 0) +
      (Number(monthlyExpenses.monthlyTaxes) || 0);
    
    const monthsCovered = essentialExpenses > 0 ? emergencyFundSize / essentialExpenses : 0;
    
    // Simplified scoring: 6 months = 100, 3 months = 50, linear scale
    let score = Math.min(100, (monthsCovered / 6) * 100);
    if (monthsCovered >= 6) score = 100;
    else if (monthsCovered >= 3) score = 50 + ((monthsCovered - 3) / 3) * 50;
    else if (monthsCovered >= 1) score = 25 + ((monthsCovered - 1) / 2) * 25;
    else score = Math.max(0, monthsCovered * 25);
    
    return Math.round(score);
  };

  // Toggle expanded state for dashboard sections
  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Smart defaults: auto-expand sections that need attention
  useEffect(() => {
    if (!profile) return;
    
    const autoExpandSections: { [key: string]: boolean } = {};
    
    // Auto-expand if financial health score is low
    const financialHealthScore = calculateFinancialHealthScore();
    if (financialHealthScore < 60) {
      autoExpandSections.financialHealth = true;
    }
    
    // Auto-expand if cash flow is negative
    const currentMonthlyCashFlow = calculateCorrectedMonthlyCashFlow();
    if (currentMonthlyCashFlow < 0) {
      autoExpandSections.cashFlow = true;
    }
    
    // Auto-expand if emergency fund is inadequate
    const emergencyScore = (typeof snapEmergency?.score === 'number')
      ? Math.round(snapEmergency.score)
      : (profile?.emergencyReadinessScore !== undefined && profile?.emergencyReadinessScore !== null
        ? profile.emergencyReadinessScore
        : (profile?.emergencyReadinessScoreCFP || calculateEmergencyReadinessScore()));
    if (emergencyScore < 60) {
      autoExpandSections.emergencyFund = true;
    }
    
    // Auto-expand if insurance adequacy is low (only if score exists)
    if (insuranceScore && insuranceScore < 60) {
      autoExpandSections.insuranceAdequacy = true;
    }
    
    setExpandedSections(prev => ({ ...prev, ...autoExpandSections }));
  }, [profile, insuranceScore]);

  // Navigate to intake form with specific section
  const navigateToIntakeSection = (sectionType: string) => {
    // Dispatch custom event to navigate to intake form with specific section
    const event = new CustomEvent('navigateToIntakeSection', {
      detail: { sectionType }
    });
    window.dispatchEvent(event);
  };

  // Open quick edit modal
  const openQuickEdit = (editType: 'income' | 'retirement' | 'risk') => {
    setQuickEditModal({ isOpen: true, editType });
  };

  // Handle quick edit save
  const handleQuickEditSave = async (data: any) => {
    try {
      const response = await fetch('/api/financial-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      // Refresh profile data
      await fetchProfile();
      
      // Dispatch profile update event
      window.dispatchEvent(new CustomEvent('profileUpdated'));
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  useEffect(() => {
    // Timer to track loading seconds
    let secondsTimer: NodeJS.Timeout | undefined;
    
    if (loading) {
      secondsTimer = setInterval(() => {
        setLoadingSeconds(prev => prev + 1);
      }, 1000);
    }
    
    fetchProfile();
    
    // Listen for profile updates
    const handleProfileUpdate = () => {
      fetchProfile();
    };
    
    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      if (secondsTimer) clearInterval(secondsTimer);
    };
  }, []);

  const fetchProfile = async () => {
    try {
      // Use persisted calculations for fast dashboard load (don't force refresh)
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/financial-profile?fast=true&t=${timestamp}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Received profile data:', {
          hasCalculations: !!data?.calculations,
          healthScore: data?.calculations?.healthScore,
          breakdown: data?.calculations?.breakdown,
          hasCurrentAllocation: !!data?.currentAllocation,
          currentAllocation: data?.currentAllocation,
          riskProfile: data?.calculations?.riskProfile,
          riskScore: data?.calculations?.riskScore,
          riskQuestions: data?.riskQuestions,
          spouseRiskProfile: data?.calculations?.spouseRiskProfile,
          spouseRiskScore: data?.calculations?.spouseRiskScore,
          spouseTargetAllocation: data?.calculations?.spouseTargetAllocation,
          spouseRiskQuestions: data?.spouseRiskQuestions,
          recommendationsCount: data?.calculations?.recommendations?.length || 0,
          optimalRetirementAge: data?.calculations?.optimalRetirementAge,
          lastUpdated: data?.lastUpdated
        });
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Set a default empty profile to prevent UI errors
      setProfile(null);
    } finally {
      setLoadingSeconds(0);
      setLoading(false);
    }
  };


  const handleResetFinancialData = async () => {
    setExporting(true);
    
    try {
      const response = await fetch('/api/reset-financial-data', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (response.ok) {
        const responseData = await response.json();
        
        // Clear localStorage completely
        localStorage.removeItem('intake-form-data');
        localStorage.removeItem('intake-form-step');
        localStorage.removeItem('asset-beneficiaries');
        localStorage.removeItem('estate-beneficiaries');
        localStorage.clear();
        
        // Reset profile state
        setProfile(null);
        
        // Clear ALL React Query caches - comprehensive invalidation
        await queryClient.clear(); // Clear all cached queries
        console.log('✅ Cleared all React Query cache');
        
        // Clear any global state/caches
        window.dispatchEvent(new CustomEvent('profileUpdated'));
        window.dispatchEvent(new CustomEvent('dataReset')); // New event for components to listen to
        
        toast({
          title: "Complete Data Reset Successful",
          description: `All your financial data has been permanently removed from ${responseData.deletedSections?.length || 12} sections. The page will reload to ensure a clean slate.`,
        });
        
        console.log('🎉 Comprehensive reset completed:', responseData);
        
        // Forcefully reload the page to ensure clean state
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        throw new Error('Reset failed');
      }
    } catch (error) {
      console.error('Error resetting data:', error);
      toast({
        title: "Reset Failed",
        description: "There was an error resetting your financial data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  // Calculate current net worth from assets and liabilities - needed for dashboard display
  const calculateNetWorth = () => {
    if (!profile) return 0;
    
    const totalAssets = (profile.assets || []).reduce((sum, asset) => sum + asset.value, 0);
    const totalLiabilities = (profile.liabilities || []).reduce((sum, liability) => sum + liability.balance, 0);
    const homeEquity = profile.primaryResidence ? 
      profile.primaryResidence.marketValue - profile.primaryResidence.mortgageBalance : 0;
    
    return totalAssets + homeEquity - totalLiabilities;
  };

  const calculateMonthlyCashFlow = () => {
    return calculateCorrectedMonthlyCashFlow();
  };

  const calculateFinancialHealthScore = () => {
    if (!profile) return 0;
    
    // First priority: Use database-persisted financial health score
    if (profile.financialHealthScore !== undefined && profile.financialHealthScore !== null) {
      return profile.financialHealthScore;
    }
    
    // Second priority: Use server-calculated comprehensive health score from calculations
    if (profile.calculations?.healthScore !== undefined) {
      return profile.calculations.healthScore;
    }
    
    // Fallback to simple calculation if server calculation not available
    const monthlyCashFlow = calculateMonthlyCashFlow();
    
    let score = 50; // Base score
    if (monthlyCashFlow > 0) score += 15;
    if (monthlyCashFlow > 1000) score += 5;
    
    return Math.min(100, Math.max(0, score));
  };

  // Helper functions for recommendations
  const getRecommendationGap = (rec: Recommendation): string => {
    const gapMap: { [key: string]: string } = {
      'Build Emergency Fund': 'Currently have less than 3 months of expenses saved',
      'Increase Emergency Fund': 'Emergency fund covers less than 6 months of expenses',
      'Pay Down High-Interest Debt': 'Credit card or high-interest debt reducing cash flow',
      'Review Insurance Coverage': 'Current coverage may have gaps or be outdated',
      'Optimize Investment Portfolio': 'Asset allocation differs from target by over 15%',
      'Increase Retirement Savings': 'Current savings rate below recommended 15%',
      'Create Estate Plan': 'No will or estate planning documents in place',
      'Review Tax Strategy': 'Potential tax optimization opportunities identified'
    };
    return gapMap[rec.title] || rec.description.substring(0, 100) + '...';
  };

  const getRecommendationTarget = (rec: Recommendation): string => {
    const targetMap: { [key: string]: string } = {
      'Build Emergency Fund': '3-6 months of essential expenses in liquid savings',
      'Increase Emergency Fund': 'Full 6 months coverage for comprehensive protection',
      'Pay Down High-Interest Debt': 'Eliminate high-interest debt to improve cash flow',
      'Review Insurance Coverage': 'Adequate coverage aligned with current life situation',
      'Optimize Investment Portfolio': 'Portfolio aligned with risk profile and goals',
      'Increase Retirement Savings': 'Save 15-20% of income for retirement',
      'Create Estate Plan': 'Complete estate planning documents in place',
      'Review Tax Strategy': 'Optimized tax strategy reducing overall tax burden'
    };
    return targetMap[rec.title] || 'Achieve financial goal';
  };

  const getEstimatedTime = (priority: number): string => {
    if (priority <= 2) return '1-2 weeks';
    if (priority === 3) return '1-3 months';
    return '3-6 months';
  };

  const getEstimatedCost = (category: string): string => {
    const costMap: { [key: string]: string } = {
      'emergency planning': 'Free',
      'debt management': 'Free',
      'retirement planning': 'Free',
      'risk management': '$50-200/mo',
      'insurance': '$50-500/mo',
      'investment strategy': 'Free-0.25%',
      'goal planning': 'Free',
      'tax planning': '$200-500',
      'estate planning': '$500-2000'
    };
    return costMap[category.toLowerCase()] || 'Varies';
  };

  if (loading && !dashSnapshot) {
    return (
      <div className="p-6 fade-in">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-semibold text-purple-400">{loadingSeconds}s</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-white text-xl font-medium">Loading your financial dashboard...</p>
              <p className="text-gray-400 text-sm">
                {loadingSeconds < 2 && "Retrieving your financial profile..."}
                {loadingSeconds >= 2 && loadingSeconds < 4 && "Calculating financial metrics..."}
                {loadingSeconds >= 4 && loadingSeconds < 6 && "Analyzing your portfolio..."}
                {loadingSeconds >= 6 && "Preparing personalized insights..."}
              </p>
            </div>
            {loadingSeconds > 3 && (
              <div className="mt-6">
                <div className="w-64 h-2 bg-gray-700 rounded-full mx-auto overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((loadingSeconds / 8) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!profile && !dashSnapshot) {
    return (
      <div className="p-6 fade-in">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">
            Welcome back! 💫
          </h1>
          <h2 className="text-2xl text-gray-300 mb-6">
            Your Financial Journey Starts Here
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
            Answer a few questions to unlock 11 powerful financial planning tools including 
            debt management, life goals planning, and personalized recommendations.
          </p>
          
          {/* Journey Progress Visual */}
          <div className="max-w-3xl mx-auto mb-8">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-purple-500/20 border-2 border-purple-500 flex items-center justify-center mb-2 animate-pulse">
                  <span className="text-2xl">?</span>
                </div>
                <span className="text-sm text-gray-400">Profile</span>
                <span className="text-xs text-purple-400 font-medium">You are here</span>
              </div>
              <div className="w-16 h-0.5 bg-gray-600"></div>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-gray-700/50 border-2 border-gray-600 flex items-center justify-center mb-2">
                  <span className="text-2xl opacity-50">📊</span>
                </div>
                <span className="text-sm text-gray-500">Analysis</span>
              </div>
              <div className="w-16 h-0.5 bg-gray-600"></div>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-gray-700/50 border-2 border-gray-600 flex items-center justify-center mb-2">
                  <span className="text-2xl opacity-50">🎯</span>
                </div>
                <span className="text-sm text-gray-500">Goals</span>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full max-w-md mx-auto">
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500" 
                     style={{ width: '5%' }}></div>
              </div>
              <p className="text-sm text-gray-400 mt-2">5% Complete</p>
            </div>
          </div>
          
          {/* Time and Security Badges */}
          <div className="flex items-center justify-center gap-6 text-sm text-gray-400 mb-8">
            <span className="flex items-center gap-1">
              <span>⏱️</span> 15 min
            </span>
            <span className="flex items-center gap-1">
              <span>🔒</span> Bank-level security
            </span>
            <span className="flex items-center gap-1">
              <span>💾</span> Auto-save enabled
            </span>
          </div>
        </div>
        
        {/* Value Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12 max-w-6xl mx-auto">
          
          {/* Cash Flow Card */}
          <div className="relative group">
            <div className="card-gradient border-gray-700 p-6 h-full transition-all duration-300 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">📈</span>
                <div className="w-8 h-8 rounded-full bg-gray-700/50 flex items-center justify-center transition-transform group-hover:animate-wiggle">
                  <span className="text-gray-400">🔒</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Cash Flow</h3>
              <p className="text-gray-400 text-sm">Track monthly income & expenses</p>
            </div>
          </div>
          
          {/* Health Score Card */}
          <div className="relative group">
            <div className="card-gradient border-gray-700 p-6 h-full transition-all duration-300 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">🏆</span>
                <div className="w-8 h-8 rounded-full bg-gray-700/50 flex items-center justify-center transition-transform group-hover:animate-wiggle">
                  <span className="text-gray-400">🔒</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Health Score</h3>
              <p className="text-gray-400 text-sm">Get your comprehensive financial wellness rating</p>
            </div>
          </div>
          
          {/* Goal Planning Card */}
          <div className="relative group">
            <div className="card-gradient border-gray-700 p-6 h-full transition-all duration-300 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">🎯</span>
                <div className="w-8 h-8 rounded-full bg-gray-700/50 flex items-center justify-center transition-transform group-hover:animate-wiggle">
                  <span className="text-gray-400">🔒</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Goal Planning</h3>
              <p className="text-gray-400 text-sm">Success probability for your life goals</p>
            </div>
          </div>
          
          {/* Financial Insights Card */}
          <div className="relative group">
            <div className="card-gradient border-gray-700 p-6 h-full transition-all duration-300 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">🤖</span>
                <div className="w-8 h-8 rounded-full bg-gray-700/50 flex items-center justify-center transition-transform group-hover:animate-wiggle">
                  <span className="text-gray-400">🔒</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Financial Insights</h3>
              <p className="text-gray-400 text-sm">24/7 personalized financial guidance</p>
            </div>
          </div>
          
          {/* Allocations Card */}
          <div className="relative group">
            <div className="card-gradient border-gray-700 p-6 h-full transition-all duration-300 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">📊</span>
                <div className="w-8 h-8 rounded-full bg-gray-700/50 flex items-center justify-center transition-transform group-hover:animate-wiggle">
                  <span className="text-gray-400">🔒</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Asset Allocation</h3>
              <p className="text-gray-400 text-sm">Investment strategy recommendations</p>
            </div>
          </div>
          
          {/* Retirement Planning Card */}
          <div className="relative group">
            <div className="card-gradient border-gray-700 p-6 h-full transition-all duration-300 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">🏖️</span>
                <div className="w-8 h-8 rounded-full bg-gray-700/50 flex items-center justify-center transition-transform group-hover:animate-wiggle">
                  <span className="text-gray-400">🔒</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Retirement Planning</h3>
              <p className="text-gray-400 text-sm">Plan for a secure financial future</p>
            </div>
          </div>
          
          {/* Tax Planning Card */}
          <div className="relative group">
            <div className="card-gradient border-gray-700 p-6 h-full transition-all duration-300 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">📋</span>
                <div className="w-8 h-8 rounded-full bg-gray-700/50 flex items-center justify-center transition-transform group-hover:animate-wiggle">
                  <span className="text-gray-400">🔒</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Tax Planning</h3>
              <p className="text-gray-400 text-sm">Optimize your tax strategies</p>
            </div>
          </div>
          
          {/* Education Planning Card */}
          <div className="relative group">
            <div className="card-gradient border-gray-700 p-6 h-full transition-all duration-300 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">🎓</span>
                <div className="w-8 h-8 rounded-full bg-gray-700/50 flex items-center justify-center transition-transform group-hover:animate-wiggle">
                  <span className="text-gray-400">🔒</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Education Planning</h3>
              <p className="text-gray-400 text-sm">Fund your family's education goals</p>
            </div>
          </div>
        </div>
        
        {/* Connect Accounts Teaser */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative card-gradient border-purple-500/30 p-6 rounded-lg hover:border-purple-500/50 transition-all duration-300 cursor-pointer"
                 onClick={() => setLocation('/connections')}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                      <LinkIcon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">Connect Your Accounts</h3>
                  </div>
                  <p className="text-gray-300 mb-4">
                    Securely link your bank accounts, credit cards, and investment accounts for automatic tracking and real-time insights.
                  </p>
                  <div className="flex items-center gap-6 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Shield className="w-4 h-4" />
                      Bank-level encryption
                    </span>
                    <span className="flex items-center gap-1">
                      <RefreshCw className="w-4 h-4" />
                      Auto-sync daily
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      10,000+ institutions
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-purple-400 transition-colors" />
              </div>
            </div>
          </div>
        </div>
        
        {/* CTA Section */}
        <div className="text-center max-w-2xl mx-auto">
          {/* Get Started Card */}
          <div className="max-w-lg mx-auto mb-8">
            <div className="card-gradient border-purple-500/50 p-6 text-left hover:border-purple-500 transition-all cursor-pointer"
                 onClick={() => window.dispatchEvent(new CustomEvent('navigateToIntakeSection', { detail: { sectionType: 'complete' } }))}>
              <h4 className="text-white font-semibold mb-3 text-lg">Complete Financial Assessment (15 min)</h4>
              <ul className="text-gray-300 text-sm space-y-2">
                <li>• Full financial analysis and health score</li>
                <li>• Personalized AI recommendations</li>
                <li>• Retirement planning with Monte Carlo simulation</li>
                <li>• Tax optimization strategies</li>
                <li>• Investment portfolio recommendations</li>
              </ul>
            </div>
          </div>
          
          {/* Main CTA Button */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigateToIntakeSection', { detail: { sectionType: 'start' } }))}
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5 text-lg"
          >
            🚀 Start Your Financial Assessment
          </button>
          
          {/* Financial Assistant Chat - moved below intake form button */}
          <div className="max-w-md mx-auto mt-8 mb-8">
            <div className="card-gradient border-purple-500/30 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">💬</span>
                </div>
                <div className="flex-1">
                  <p className="text-gray-300 text-sm">
                    "Hi! I'm your financial assistant. Complete your profile so I can provide personalized guidance tailored to your unique situation!"
                  </p>
                  <button 
                    className="text-purple-400 text-sm mt-2 hover:text-purple-300 transition-colors"
                    onClick={() => window.dispatchEvent(new CustomEvent('navigateToIntakeSection', { detail: { sectionType: 'start' } }))}
                  >
                    Start Chat →
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Trust Indicators */}
          <div className="flex items-center justify-center gap-4 mt-8 text-xs text-gray-500">
            <span>🔒 Your data is encrypted</span>
            <span>•</span>
            <span>We never sell your data</span>
          </div>
        </div>
      </div>
    );
  }
  // Calculate data from profile - prioritize persisted database values
  const financialHealthScore = (typeof snapHealth?.score === 'number')
    ? Math.round(snapHealth.score)
    : calculateFinancialHealthScore();
  
  // Calculate corrected monthly cash flow
  const calculateCorrectedMonthlyCashFlow = () => {
    if (!profile) return 0;
    
    // === INCOME CALCULATION ===
    let totalMonthlyIncome = 0;
    
    // User income
    const userEmploymentStatus = (profile?.employmentStatus || '').toLowerCase();
    const userTakeHome = Number(profile?.takeHomeIncome) || 0;
    const userAnnualIncome = Number(profile?.annualIncome) || 0;
    
    if (userEmploymentStatus.includes('self-employed') || userEmploymentStatus.includes('self employed')) {
      totalMonthlyIncome += userAnnualIncome / 12;
    } else if (userTakeHome > 0) {
      totalMonthlyIncome += userTakeHome / 12;
    } else if (userAnnualIncome > 0) {
      totalMonthlyIncome += userAnnualIncome / 12;
    }
    
    // Spouse income (if married/partnered)
    if (profile?.maritalStatus === 'married' || profile?.maritalStatus === 'partnered') {
      const spouseEmploymentStatus = (profile?.spouseEmploymentStatus || '').toLowerCase();
      const spouseTakeHome = Number(profile?.spouseTakeHomeIncome) || 0;
      const spouseAnnualIncome = Number(profile?.spouseAnnualIncome) || 0;
      
      if (spouseEmploymentStatus.includes('self-employed') || spouseEmploymentStatus.includes('self employed')) {
        totalMonthlyIncome += spouseAnnualIncome / 12;
      } else if (spouseTakeHome > 0) {
        totalMonthlyIncome += spouseTakeHome / 12;
      } else if (spouseAnnualIncome > 0) {
        totalMonthlyIncome += spouseAnnualIncome / 12;
      }
    }
    
    totalMonthlyIncome += Number(profile?.otherIncome) || 0;
    
    // === EXPENSE CALCULATION ===
    const expenses = profile?.monthlyExpenses || {};
    const userIsSelfEmployed = userEmploymentStatus.includes('self-employed') || userEmploymentStatus.includes('self employed');
    const spouseIsSelfEmployed = (profile?.spouseEmploymentStatus || '').toLowerCase().includes('self-employed') || 
                                (profile?.spouseEmploymentStatus || '').toLowerCase().includes('self employed');
    const anyoneIsSelfEmployed = userIsSelfEmployed || spouseIsSelfEmployed;
    
    let totalMonthlyExpenses = 0;
    if (anyoneIsSelfEmployed) {
      totalMonthlyExpenses = Object.entries(expenses).reduce((sum, [key, expense]) => {
        if (key === 'expectedAnnualTaxes') {
          return sum + ((Number(expense) || 0) / 12);
        }
        return sum + (Number(expense) || 0);
      }, 0);
    } else {
      const monthlyExpensesOnly = { ...expenses };
      if ('expectedAnnualTaxes' in monthlyExpensesOnly) {
        delete (monthlyExpensesOnly as any).expectedAnnualTaxes;
      }
      totalMonthlyExpenses = Object.values(monthlyExpensesOnly).reduce(
        (sum: number, expense: any) => sum + (Number(expense) || 0),
        0
      );
    }
    
    // === RETIREMENT CONTRIBUTIONS ===
    const userRetirement = profile?.retirementContributions || { employee: 0, employer: 0 };
    const spouseRetirement = profile?.spouseRetirementContributions || { employee: 0, employer: 0 };
    let totalMonthlyRetirementContributions = (userRetirement.employee || 0) + (spouseRetirement.employee || 0);
    
    const monthlyTraditionalIRA = (Number(profile?.traditionalIRAContribution) || 0) / 12;
    const monthlyRothIRA = (Number(profile?.rothIRAContribution) || 0) / 12;
    const monthlySpouseTraditionalIRA = (Number(profile?.spouseTraditionalIRAContribution) || 0) / 12;
    const monthlySpouseRothIRA = (Number(profile?.spouseRothIRAContribution) || 0) / 12;
    
    totalMonthlyRetirementContributions += monthlyTraditionalIRA + monthlyRothIRA + 
                                         monthlySpouseTraditionalIRA + monthlySpouseRothIRA;
    
    return totalMonthlyIncome - totalMonthlyExpenses - totalMonthlyRetirementContributions;
  };
  
  // Prioritize persisted monthly cash flow value from database
  const monthlyCashFlow = (typeof snapCash?.monthly === 'number')
    ? Number(snapCash.monthly)
    : (profile?.monthlyCashFlow !== undefined && profile?.monthlyCashFlow !== null
      ? Number(profile.monthlyCashFlow)
      : (profile?.calculations?.monthlyCashFlow ?? calculateCorrectedMonthlyCashFlow()));

  // Get actual risk profile and allocation data (prefer snapshot)
  const getRiskProfileDescription = (riskProfile: string) => {
    switch (riskProfile) {
      case 'Conservative':
        return 'Capital preservation focus with minimal volatility tolerance (Score: 10-19)';
      case 'Moderately Conservative':
        return 'Modest growth with stability emphasis and low risk tolerance (Score: 20-27)';
      case 'Moderate':
        return 'Balanced growth and income approach with moderate risk acceptance (Score: 28-35)';
      case 'Moderately Aggressive':
        return 'Growth-oriented with higher risk tolerance for enhanced returns (Score: 36-43)';
      case 'Aggressive':
        return 'Maximum growth potential with high volatility acceptance (Score: 44-50)';
      case 'Not Assessed':
        return 'Complete the CFP Board risk questionnaire to determine your profile';
      default:
        return 'Complete the CFP Board risk questionnaire to determine your profile';
    }
  };

  const getTargetAllocationData = () => {
    const targetAllocation = profile?.targetAllocation || profile?.calculations?.targetAllocation;
    if (!targetAllocation) return [];
    
    return [
      { name: "US Stocks", value: targetAllocation.usStocks || 0, color: "#B040FF" },
      { name: "Intl Stocks", value: targetAllocation.intlStocks || 0, color: "#a020f0" },
      { name: "Bonds", value: targetAllocation.bonds || 0, color: "#10B981" },
      { name: "Alternatives", value: targetAllocation.alternatives || 0, color: "#F59E0B" },
      { name: "Cash", value: targetAllocation.cash || 0, color: "#EF4444" },
    ].filter(item => item.value > 0);
  };



  const getSpouseCurrentAllocationData = () => {
    const spouseAllocation = profile?.spouseAllocation;
    if (!spouseAllocation) return [];
    
    return [
      { name: "US Stocks", value: spouseAllocation.usStocks || 0, color: "#B040FF" },
      { name: "Intl Stocks", value: spouseAllocation.intlStocks || 0, color: "#a020f0" },
      { name: "Bonds", value: spouseAllocation.bonds || 0, color: "#10B981" },
      { name: "Alternatives", value: spouseAllocation.alternatives || 0, color: "#F59E0B" },
      { name: "Cash", value: spouseAllocation.cash || 0, color: "#EF4444" },
    ].filter(item => item.value > 0);
  };

  const getSpouseTargetAllocationData = () => {
    const spouseTargetAllocation = profile?.spouseTargetAllocation || profile?.calculations?.spouseTargetAllocation;
    if (!spouseTargetAllocation) return [];
    
    return [
      { name: "US Stocks", value: spouseTargetAllocation.usStocks || 0, color: "#B040FF" },
      { name: "Intl Stocks", value: spouseTargetAllocation.intlStocks || 0, color: "#a020f0" },
      { name: "Bonds", value: spouseTargetAllocation.bonds || 0, color: "#10B981" },
      { name: "Alternatives", value: spouseTargetAllocation.alternatives || 0, color: "#F59E0B" },
      { name: "Cash", value: spouseTargetAllocation.cash || 0, color: "#EF4444" },
    ].filter(item => item.value > 0);
  };



  const getCurrentAllocationData = () => {
    // Prefer snapshot allocation for instant paint
    const currentAllocation = snapRisk?.allocation || profile?.currentAllocation;
    if (!currentAllocation || typeof currentAllocation !== 'object') {
      return [
        { name: "No Data", value: 100, color: "#6B7280" }
      ];
    }
    
    const data = [
      { name: "US Stocks", value: currentAllocation.usStocks || 0, color: "#B040FF" },
      { name: "Intl Stocks", value: currentAllocation.intlStocks || 0, color: "#a020f0" },
      { name: "Bonds", value: currentAllocation.bonds || 0, color: "#10B981" },
      { name: "Alternatives", value: currentAllocation.alternatives || 0, color: "#F59E0B" },
      { name: "Cash", value: currentAllocation.cash || 0, color: "#EF4444" },
    ].filter(item => item.value > 0);
    
    return data.length > 0 ? data : [{ name: "No Data", value: 100, color: "#6B7280" }];
  };

  const shouldShowRebalanceAlert = () => {
    const target = profile?.calculations?.targetAllocation;
    const current = profile?.currentAllocation;
    const riskProfile = profile?.calculations?.riskProfile;
    
    if (!target || !current || !riskProfile || riskProfile === 'Not Assessed') return false;
    
    // Check if any allocation differs by more than 15%
    const threshold = 15;
    return Math.abs((current.usStocks || 0) - (target.usStocks || 0)) > threshold ||
           Math.abs((current.intlStocks || 0) - (target.intlStocks || 0)) > threshold ||
           Math.abs((current.bonds || 0) - (target.bonds || 0)) > threshold ||
           Math.abs((current.alternatives || 0) - (target.alternatives || 0)) > threshold ||
           Math.abs((current.cash || 0) - (target.cash || 0)) > threshold;
  };

  const getRebalanceRecommendations = () => {
    const target = profile?.calculations?.targetAllocation;
    const current = profile?.currentAllocation;
    if (!target || !current) return [];
    
    return [
      { asset: "US Stocks", change: (target.usStocks || 0) - (current.usStocks || 0) },
      { asset: "International Stocks", change: (target.intlStocks || 0) - (current.intlStocks || 0) },
      { asset: "Bonds", change: (target.bonds || 0) - (current.bonds || 0) },
      { asset: "Alternatives", change: (target.alternatives || 0) - (current.alternatives || 0) },
      { asset: "Cash", change: (target.cash || 0) - (current.cash || 0) },
    ].filter(item => Math.abs(item.change) > 5); // Only show significant changes
  };

  const getAllocationData = () => {
    if (!profile || !profile.assets) return [];
    
    const totalAssets = profile.assets.reduce((sum, asset) => sum + asset.value, 0);
    if (totalAssets === 0) return [];
    
    const stockAssets = profile.assets.filter(asset => 
      asset.type && (asset.type.toLowerCase().includes('stock') || asset.type.toLowerCase().includes('equity'))
    ).reduce((sum, asset) => sum + asset.value, 0);
    
    const bondAssets = profile.assets.filter(asset => 
      asset.type && asset.type.toLowerCase().includes('bond')
    ).reduce((sum, asset) => sum + asset.value, 0);
    
    const realEstateAssets = profile.assets.filter(asset => 
      asset.type && asset.type.toLowerCase().includes('real estate')
    ).reduce((sum, asset) => sum + asset.value, 0);
    
    const cashAssets = profile.assets.filter(asset => 
      asset.type && (asset.type.toLowerCase().includes('cash') || asset.type.toLowerCase().includes('savings'))
    ).reduce((sum, asset) => sum + asset.value, 0);
    
    return [
      { name: "Stocks", value: Math.round((stockAssets / totalAssets) * 100), color: "#6A0DAD" },
      { name: "Bonds", value: Math.round((bondAssets / totalAssets) * 100), color: "#B040FF" },
      { name: "Real Estate", value: Math.round((realEstateAssets / totalAssets) * 100), color: "#4ADE80" },
      { name: "Cash", value: Math.round((cashAssets / totalAssets) * 100), color: "#FACC15" },
    ].filter(item => item.value > 0);
  };

  const allocationData = getAllocationData();

  return (
    <div className="p-6 fade-in">
      {/* Incomplete Form Notification */}
      {profile && !isIntakeFormComplete(profile) && (
        <div className="mb-6">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-8 bg-purple-500 rounded-full" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-white">
                      Setup Incomplete
                    </h3>
                    <span className="text-xs text-gray-400">
                      • {!profile.desiredRetirementAge ? 'Retirement planning missing' : 
                         !(Number(profile.annualIncome) > 0 || Number((profile as any).takeHomeIncome) > 0) ? 'Income details missing' :
                         !profile.assets?.length ? 'Assets missing' : 'Final steps needed'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Complete your intake form to enable accurate calculations and personalized insights
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setLocation("/intake")}
                className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
              >
                Complete Setup
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-2 text-white">Financial Dashboard</h2>
          <p className="text-gray-400">Your comprehensive financial overview</p>
        </div>
        <Button
          onClick={refreshDashboardData}
          className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-300 shadow-md hover:shadow-purple-500/25 flex items-center gap-2"
          disabled={isRefreshing}
          title="Refresh all dashboard data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh All
        </Button>
      </div>
      
      {/* Primary Metrics - Hero Section */}
      <div className="mb-12">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Primary Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="card-gradient border-gray-700 hover-lift widget-card bg-gradient-to-br from-gray-900/50 to-gray-800/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-semibold text-white">Financial Health</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateToIntakeSection('financial')}
                className="h-6 w-6 p-0 text-gray-400 hover:text-white"
              >
                <Edit3 className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="w-6 h-6 text-[#B040FF]" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection('financialHealth')}
                className="h-6 w-6 p-0 text-gray-400 hover:text-white expand-toggle-btn"
                aria-expanded={expandedSections.financialHealth}
                aria-label="Toggle financial health details"
              >
                <ChevronDown className={`w-4 h-4 chevron-icon ${expandedSections.financialHealth ? 'rotated' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!isIntakeFormComplete(profile) && <IncompleteDataWarning />}
            {/* Meta: last calculated + refresh */}
            <LastCalculated 
              timestamp={(profile as any)?.calculations?.calculatedAt || (profile as any)?.lastUpdated}
              onRefresh={refreshDashboardData}
              refreshing={isRefreshing}
            />
            <div className="flex flex-col items-center mb-4">
              <Gauge
                value={financialHealthScore}
                max={100}
                size="md"
                showValue={true}
                valueLabel=""
                colors={{
                  low: '#EF4444',
                  medium: '#F59E0B',
                  high: '#10B981'
                }}
                thresholds={{
                  medium: 50,
                  high: 75
                }}
              />
              <div className={`mt-3 px-3 py-1 rounded-full text-xs font-medium ${
                financialHealthScore >= 80 ? 'bg-green-900/30 text-green-400' :
                financialHealthScore >= 60 ? 'bg-blue-900/30 text-blue-400' :
                financialHealthScore >= 40 ? 'bg-yellow-900/30 text-yellow-400' :
                'bg-red-900/30 text-red-400'
              }`}>
                {financialHealthScore >= 80 ? 'Excellent' : 
                 financialHealthScore >= 60 ? 'Good' : 
                 financialHealthScore >= 40 ? 'Fair' : 'Needs Attention'}
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4 text-center">
              {financialHealthScore >= 80 ? 'Your financial health is excellent!' : 
               financialHealthScore >= 60 ? 'Your financial health is good' : 
               financialHealthScore >= 40 ? 'Your financial health needs some work' : 'Your financial health needs immediate attention'}
            </p>
            
            {/* Expandable Details */}
            <div className={`expand-content ${expandedSections.financialHealth ? 'expanded' : 'collapsed'}`}>
              <div className="border-t border-gray-600 pt-4 space-y-3">
                <h4 className="text-sm font-semibold text-white mb-3">Score Breakdown & Methodology</h4>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Emergency Fund (20%)</span>
                    <span className="text-white font-medium">{profile?.calculations?.breakdown?.emergencyFundScore || 0}/100</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Debt-to-Income (20%)</span>
                    <span className="text-white font-medium">{profile?.calculations?.breakdown?.dtiScore || 0}/100</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Savings Rate (20%)</span>
                    <span className="text-white font-medium">{profile?.calculations?.breakdown?.savingsRateScore || 0}/100</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Insurance Coverage (15%)</span>
                    <span className="text-white font-medium">{profile?.calculations?.breakdown?.insuranceScore || 0}/100</span>
                  </div>
                </div>
                
                {/* AI-Powered Improvement Suggestions */}
                
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* New Cash Flow 2.0 Widget with AI suggestions */}
        <CashFlowWidgetV2 />
        
        {/* Original Monthly Cash Flow Widget (kept for comparison) */}
        <Card className="card-gradient border-gray-700 hover-lift widget-card" style={{display: 'none'}}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-semibold text-white">Monthly Cash Flow</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openQuickEdit('income')}
                className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                title="Quick edit income"
              >
                <Edit3 className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-[#B040FF]" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection('cashFlow')}
                className="h-6 w-6 p-0 text-gray-400 hover:text-white expand-toggle-btn"
                aria-expanded={expandedSections.cashFlow}
                aria-label="Toggle cash flow details"
              >
                <ChevronDown className={`w-4 h-4 chevron-icon ${expandedSections.cashFlow ? 'rotated' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              // Calculate corrected monthly cash flow using the fixed logic
              
              // === INCOME CALCULATION ===
              let totalMonthlyIncome = 0;
              
              // User income
              const userEmploymentStatus = (profile?.employmentStatus || '').toLowerCase();
              const userTakeHome = Number(profile?.takeHomeIncome) || 0;
              const userAnnualIncome = Number(profile?.annualIncome) || 0;
              
              if (userEmploymentStatus.includes('self-employed') || userEmploymentStatus.includes('self employed')) {
                // Self-employed: use gross annual income / 12
                totalMonthlyIncome += userAnnualIncome / 12;
              } else if (userTakeHome > 0) {
                // If take-home is provided, use it (most accurate for employed) - divide by 12 since it's annual
                totalMonthlyIncome += userTakeHome / 12;
              } else if (userAnnualIncome > 0) {
                // Fallback: use annual / 12
                totalMonthlyIncome += userAnnualIncome / 12;
              }
              
              // Spouse income (if married/partnered)
              if (profile?.maritalStatus === 'married' || profile?.maritalStatus === 'partnered') {
                const spouseEmploymentStatus = (profile?.spouseEmploymentStatus || '').toLowerCase();
                const spouseTakeHome = Number(profile?.spouseTakeHomeIncome) || 0;
                const spouseAnnualIncome = Number(profile?.spouseAnnualIncome) || 0;
                
                if (spouseEmploymentStatus.includes('self-employed') || spouseEmploymentStatus.includes('self employed')) {
                  // Self-employed spouse: use gross annual income / 12
                  totalMonthlyIncome += spouseAnnualIncome / 12;
                } else if (spouseTakeHome > 0) {
                  // If spouse take-home is provided, use it - divide by 12 since it's annual
                  totalMonthlyIncome += spouseTakeHome / 12;
                } else if (spouseAnnualIncome > 0) {
                  // Fallback: use annual / 12
                  totalMonthlyIncome += spouseAnnualIncome / 12;
                }
              }
              
              // Add other income sources (already monthly)
              totalMonthlyIncome += Number(profile?.otherIncome) || 0;
              
              // === EXPENSE CALCULATION ===
              const expenses = profile?.monthlyExpenses || {};
              
              // Check if user or spouse is self-employed to determine if we should include taxes
              const userIsSelfEmployed = userEmploymentStatus.includes('self-employed') || userEmploymentStatus.includes('self employed');
              const spouseIsSelfEmployed = (profile?.spouseEmploymentStatus || '').toLowerCase().includes('self-employed') || 
                                          (profile?.spouseEmploymentStatus || '').toLowerCase().includes('self employed');
              const anyoneIsSelfEmployed = userIsSelfEmployed || spouseIsSelfEmployed;
              
              let totalMonthlyExpenses = 0;
              if (anyoneIsSelfEmployed) {
                // Include all expenses including annual taxes (divided by 12) for self-employed
                totalMonthlyExpenses = Object.entries(expenses).reduce((sum, [key, expense]) => {
                  if (key === 'expectedAnnualTaxes') {
                    return sum + ((Number(expense) || 0) / 12); // Convert annual to monthly
                  }
                  return sum + (Number(expense) || 0);
                }, 0);
              } else {
                // For employed users, exclude expectedAnnualTaxes to avoid double counting
                const monthlyExpensesOnly = { ...expenses };
                if ('expectedAnnualTaxes' in monthlyExpensesOnly) {
                  delete (monthlyExpensesOnly as any).expectedAnnualTaxes;
                }
                
                totalMonthlyExpenses = Object.values(monthlyExpensesOnly).reduce(
                  (sum: number, expense: any) => sum + (Number(expense) || 0),
                  0
                );
              }
              
              // === RETIREMENT CONTRIBUTIONS ===
              const userRetirement = profile?.retirementContributions || { employee: 0, employer: 0 };
              const spouseRetirement = profile?.spouseRetirementContributions || { employee: 0, employer: 0 };
              
              // Employee contributions only (employer contributions don't come from cash flow)
              let totalMonthlyRetirementContributions = (userRetirement.employee || 0) + (spouseRetirement.employee || 0);
              
              // Add IRA contributions (these are annual amounts, convert to monthly)
              const monthlyTraditionalIRA = (Number(profile?.traditionalIRAContribution) || 0) / 12;
              const monthlyRothIRA = (Number(profile?.rothIRAContribution) || 0) / 12;
              const monthlySpouseTraditionalIRA = (Number(profile?.spouseTraditionalIRAContribution) || 0) / 12;
              const monthlySpouseRothIRA = (Number(profile?.spouseRothIRAContribution) || 0) / 12;
              
              totalMonthlyRetirementContributions += monthlyTraditionalIRA + monthlyRothIRA + 
                                                   monthlySpouseTraditionalIRA + monthlySpouseRothIRA;
              
              // === FINAL CALCULATION ===
              const correctedMonthlyCashFlow = totalMonthlyIncome - totalMonthlyExpenses - totalMonthlyRetirementContributions;
              
              return (
                <>
                  <div className="flex flex-col items-center mb-4">
                    <MetricDisplay
                      value={Math.round(correctedMonthlyCashFlow)}
                      format="currency"
                      size="lg"
                      color={correctedMonthlyCashFlow >= 0 ? 'positive' : 'negative'}
                      showSign={true}
                    />
                    <div className={`mt-3 px-3 py-1 rounded-full text-xs font-medium ${
                      correctedMonthlyCashFlow >= 1000 ? 'bg-green-900/30 text-green-400' :
                      correctedMonthlyCashFlow >= 0 ? 'bg-blue-900/30 text-blue-400' :
                      correctedMonthlyCashFlow >= -500 ? 'bg-yellow-900/30 text-yellow-400' :
                      'bg-red-900/30 text-red-400'
                    }`}>
                      {correctedMonthlyCashFlow >= 1000 ? 'Strong' :
                       correctedMonthlyCashFlow >= 0 ? 'Positive' :
                       correctedMonthlyCashFlow >= -500 ? 'Tight' : 'Critical'}
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm mb-4 text-center">
                    {correctedMonthlyCashFlow >= 1000 ? 'Excellent cash flow for savings and investments' :
                     correctedMonthlyCashFlow >= 0 ? 'Positive monthly cash flow' :
                     correctedMonthlyCashFlow >= -500 ? 'Limited surplus - consider expense optimization' :
                     'Negative cash flow requires immediate attention'}
                  </p>
                  
                  {/* Expandable Details */}
                  <div className={`expand-content ${expandedSections.cashFlow ? 'expanded' : 'collapsed'}`}>
                    <div className="border-t border-gray-600 pt-4 space-y-3">
                      <h4 className="text-sm font-semibold text-white mb-3">Cash Flow Breakdown</h4>
                      
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Monthly Income</span>
                          <span className="text-green-400 font-medium">+${Math.round(totalMonthlyIncome).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Monthly Expenses{anyoneIsSelfEmployed ? ' (incl. taxes)' : ''}</span>
                          <span className="text-red-400 font-medium">-${Math.round(totalMonthlyExpenses).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Retirement Contributions</span>
                          <span className="text-orange-400 font-medium">-${Math.round(totalMonthlyRetirementContributions).toLocaleString()}</span>
                        </div>
                        <div className="border-t border-gray-600 pt-2 flex justify-between items-center font-medium">
                          <span className="text-white">Net Cash Flow</span>
                          <span className={`${correctedMonthlyCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {correctedMonthlyCashFlow >= 0 ? '+' : ''}${Math.round(correctedMonthlyCashFlow).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      
                      {anyoneIsSelfEmployed && (
                        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded">
                          <h5 className="text-sm font-medium text-yellow-300 mb-2">ℹ️ Self-Employed Calculation</h5>
                          <p className="text-xs text-yellow-200">
                            Since you're self-employed, we use gross income and include estimated taxes in expenses.
                            {!anyoneIsSelfEmployed && ' For employed income, we use take-home pay (taxes already deducted).'}
                          </p>
                        </div>
                      )}
                      
                      {correctedMonthlyCashFlow < 500 && (
                        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700 rounded">
                          <h5 className="text-sm font-medium text-blue-300 mb-2">💡 Cash Flow Optimization Tips</h5>
                          <ul className="text-xs text-blue-200 space-y-1">
                            {correctedMonthlyCashFlow < 0 && (
                              <>
                                <li>• Review and reduce non-essential expenses</li>
                                <li>• Consider debt consolidation to lower payments</li>
                                <li>• Explore additional income opportunities</li>
                              </>
                            )}
                            {correctedMonthlyCashFlow >= 0 && correctedMonthlyCashFlow < 500 && (
                              <>
                                <li>• Build emergency fund first</li>
                                <li>• Optimize recurring subscriptions and services</li>
                                <li>• Increase savings rate gradually</li>
                              </>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
        
        {/* Net Worth Widget V2 - Current net worth from assets/liabilities */}
        <NetWorthWidgetV2 />
        
        </div>
      </div>
      
      {/* REORGANIZED LAYOUT - Secondary Metrics - Insurance and Emergency */}
      <div className="mb-12">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Protection & Emergency Readiness</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <Card className="card-gradient border-gray-700 hover-lift widget-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-semibold text-white">Insurance Adequacy Score</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateToIntakeSection('protection')}
                className="h-6 w-6 p-0 text-gray-400 hover:text-white"
              >
                <Edit3 className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-[#B040FF]" />
              <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSection('insuranceAdequacy')}
              className="h-6 w-6 p-0 text-gray-400 hover:text-white expand-toggle-btn"
              aria-expanded={expandedSections.insuranceAdequacy}
              aria-label="Toggle insurance adequacy details"
            >
              <ChevronDown className={`w-4 h-4 chevron-icon ${expandedSections.insuranceAdequacy ? 'rotated' : ''}`} />
            </Button>
            </div>
          </CardHeader>
          <CardContent className="text-center">
            <div className="mb-4">
              {/* Meta: last calculated + refresh */}
              <LastCalculated 
                timestamp={(profile as any)?.calculations?.calculatedAt || (profile as any)?.lastUpdated}
                onRefresh={refreshDashboardData}
                refreshing={isRefreshing}
              />
              <div className="flex justify-center mb-4">
                <Gauge
                value={insuranceScore}
                max={100}
                size="lg"
                showValue={true}
                valueLabel=""
                colors={{
                  low: '#EF4444',
                  medium: '#F59E0B',
                  high: '#10B981'
                }}
                thresholds={{
                  medium: 60,
                  high: 80
                }}
              />
              </div>
              <div className="mt-3">
                <p className="text-sm text-gray-400 text-center mb-2">
                  Coverage assessment across all insurance types
                </p>
                <div className="flex justify-center">
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  (() => {
                    if (insuranceScore >= 90) return 'bg-green-900/30 text-green-400';
                    if (insuranceScore >= 75) return 'bg-blue-900/30 text-blue-400';
                    if (insuranceScore >= 60) return 'bg-yellow-900/30 text-yellow-400';
                    return 'bg-red-900/30 text-red-400';
                  })()
                }`}>
                  {(() => {
                    if (insuranceScore >= 90) return 'Excellent';
                    if (insuranceScore >= 75) return 'Good';
                    if (insuranceScore >= 60) return 'Fair';
                    return 'Gap';
                  })()}
                </div>
                </div>
              </div>
            </div>
            
            <p className="text-gray-400 text-sm mb-3">
              {(() => {
                const score = profile?.calculations?.insuranceAdequacy?.score || profile?.calculations?.riskManagementScore || 0;
                if (score >= 90) return 'Comprehensive protection in place';
                if (score >= 75) return 'Good risk coverage with minor gaps';
                if (score >= 60) return 'Adequate protection but room for improvement';
                return 'Critical insurance gaps need immediate attention';
              })()}
            </p>
            
            {/* Expandable Details */}
            <div className={`expand-content ${expandedSections.insuranceAdequacy ? 'expanded' : 'collapsed'}`}>
              <div className="border-t border-gray-600 pt-4 space-y-3 text-left">
                <h4 className="text-sm font-semibold text-white mb-3">Insurance Coverage Analysis</h4>
                
                {/* IAS breakdown if available */}
                {profile?.calculations?.insuranceAdequacy?.breakdown ? (
                  <div className="space-y-3">
                    <h5 className="text-sm font-medium text-gray-300 mb-2">Coverage Breakdown:</h5>
                    <div className="text-xs space-y-2">
                      {Object.entries(profile.calculations.insuranceAdequacy.breakdown as Record<string, any>).map(([category, data]: [string, any]) => (
                        <div key={category} className="flex justify-between items-center">
                          <span className="text-gray-400 capitalize">{category}</span>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${data.score >= 80 ? 'text-green-400' : data.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {data.score}%
                            </span>
                            <span className="text-gray-500 text-xs">({data.weight}% weight)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Legacy methodology breakdown */
                  <div className="space-y-3">
                    <h5 className="text-sm font-medium text-gray-300 mb-2">Score Components:</h5>
                    <div className="text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Life Insurance (if needed)</span>
                        <span className="text-white font-medium">Up to -45 pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Disability (if working)</span>
                        <span className="text-white font-medium">-15 pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Health Insurance</span>
                        <span className="text-white font-medium">-20 pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Property (if homeowner)</span>
                        <span className="text-white font-medium">-15 pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">LTC (if 55+)</span>
                        <span className="text-white font-medium">-5 pts</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mt-4 p-3 bg-gray-800/50 border border-gray-600 rounded">
                  <h5 className="text-sm font-medium text-gray-300 mb-2">🛡️ Insurance Score Formula</h5>
                  <p className="text-xs text-gray-400">Score = 100 - (Risk Gaps × Weight × Severity)</p>
                  <p className="text-xs text-gray-400 mt-1">Evaluates life, disability, health, property, and long-term care coverage</p>
                </div>
                
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-gradient border-gray-700 hover-lift widget-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-semibold text-white">Emergency Readiness</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateToIntakeSection('financial')}
                className="h-6 w-6 p-0 text-gray-400 hover:text-white"
              >
                <Edit3 className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Umbrella className="w-6 h-6 text-[#B040FF]" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection('emergencyFund')}
                className="h-6 w-6 p-0 text-gray-400 hover:text-white expand-toggle-btn"
                aria-expanded={expandedSections.emergencyFund}
                aria-label="Toggle emergency readiness details"
              >
                <ChevronDown className={`w-4 h-4 chevron-icon ${expandedSections.emergencyFund ? 'rotated' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="text-center">
            {!isIntakeFormComplete(profile) && <IncompleteDataWarning />}
            {/* Meta: last calculated + refresh */}
            <LastCalculated 
              timestamp={(profile as any)?.calculations?.calculatedAt || (profile as any)?.lastUpdated}
              onRefresh={refreshDashboardData}
              refreshing={isRefreshing}
            />
            {(() => {
              // Use the persisted emergency readiness score from database first
              const finalScore = (typeof snapEmergency?.score === 'number')
                ? Math.round(snapEmergency.score)
                : (profile?.emergencyReadinessScore !== undefined && profile?.emergencyReadinessScore !== null
                  ? profile.emergencyReadinessScore
                  : (profile?.calculations?.emergencyReadinessScoreCFP || profile?.emergencyReadinessScoreCFP || calculateEmergencyReadinessScore()));
              
              // Get emergency fund size from profile or calculate from assets if not available
              let emergencyFundSize = Number(profile?.emergencyFundSize || 0);
              
              // Fallback: calculate from liquid assets if emergency fund size not set
              if (emergencyFundSize === 0 && profile?.assets) {
                emergencyFundSize = profile.assets
                  .filter((asset: any) => 
                    asset.type && (
                      asset.type.toLowerCase().includes('emergency') ||
                      asset.type.toLowerCase().includes('savings') ||
                      asset.type.toLowerCase().includes('checking')
                    )
                  )
                  .reduce((sum: number, asset: any) => sum + (asset.value || 0), 0);
              }
              
              const monthlyExpenses = profile?.monthlyExpenses || {};
              
              // Calculate essential monthly expenses (excluding entertainment)
              const essentialExpenses = 
                (Number(monthlyExpenses.housing) || 0) +
                (Number(monthlyExpenses.transportation) || 0) +
                (Number(monthlyExpenses.food) || 0) +
                (Number(monthlyExpenses.utilities) || 0) +
                (Number(monthlyExpenses.healthcare) || 0) +
                (Number(monthlyExpenses.creditCardPayments) || 0) +
                (Number(monthlyExpenses.studentLoanPayments) || 0) +
                (Number(monthlyExpenses.otherDebtPayments) || 0) +
                (Number(monthlyExpenses.householdExpenses) || 0) +
                (Number(monthlyExpenses.monthlyTaxes) || 0) +
                (Number(monthlyExpenses.other) || 0);
              
              const monthsCovered = essentialExpenses > 0 ? emergencyFundSize / essentialExpenses : 0;
              
              return (
                <>
                  <div className="mb-4">
                    <div className="flex justify-center mb-4">
                      <Gauge
                      value={finalScore}
                      max={100}
                      size="lg"
                      showValue={true}
                      valueLabel=""
                      colors={{
                        low: '#EF4444',
                        medium: '#F59E0B',
                        high: '#10B981'
                      }}
                      thresholds={{
                        medium: 60,
                        high: 80
                      }}
                    />
                    </div>
                    <div className="mt-3">
                      <p className="text-sm text-gray-400 text-center mb-2">
                        {monthsCovered.toFixed(1)} months of expenses covered
                      </p>
                      <div className="flex justify-center">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        finalScore >= 80 ? 'bg-green-900/30 text-green-400' :
                        finalScore >= 60 ? 'bg-blue-900/30 text-blue-400' :
                        finalScore >= 40 ? 'bg-yellow-900/30 text-yellow-400' :
                        'bg-red-900/30 text-red-400'
                      }`}>
                        {finalScore >= 80 ? 'Excellent' :
                         finalScore >= 60 ? 'Good' :
                         finalScore >= 40 ? 'Fair' : 'Critical'}
                      </div>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-gray-400 text-sm mb-4">
                    {finalScore >= 80 ? 'Excellent emergency fund coverage - well protected' : 
                     finalScore >= 60 ? 'Good emergency fund adequacy with solid coverage' : 
                     finalScore >= 40 ? 'Fair emergency fund but could use improvement' :
                     'Critical - emergency fund needs immediate attention'}
                  </p>
                  
                  {/* Expandable Details */}
                  <div className={`expand-content ${expandedSections.emergencyFund ? 'expanded' : 'collapsed'}`}>
                    <div className="border-t border-gray-600 pt-4 space-y-3">
                      <h4 className="text-sm font-semibold text-white mb-3">Emergency Fund Analysis</h4>
                      
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Emergency Fund</span>
                          <span className="text-white font-medium">${emergencyFundSize.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Essential Expenses</span>
                          <span className="text-white font-medium">${essentialExpenses.toLocaleString()}/month</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Coverage</span>
                          <span className="text-[#B040FF] font-medium">{monthsCovered.toFixed(1)} months</span>
                        </div>
                      </div>
                      
                      <div className="mt-4 p-3 bg-gray-800/50 border border-gray-600 rounded">
                        <h5 className="text-sm font-medium text-gray-300 mb-2">🏦 Emergency Fund Formula</h5>
                        <p className="text-xs text-gray-400">Coverage = Emergency Fund ÷ Essential Monthly Expenses</p>
                        <p className="text-xs text-gray-400 mt-1">Target: 3-6 months of essential expenses for optimal protection</p>
                      </div>
                      
                      {finalScore < 80 && (
                        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700 rounded">
                          <h5 className="text-sm font-medium text-blue-300 mb-2">💡 Emergency Fund Building Tips</h5>
                          <ul className="text-xs text-blue-200 space-y-1">
                            {finalScore < 40 && (
                              <>
                                <li>• Start with $1,000 starter emergency fund</li>
                                <li>• Automate $100-200/month to high-yield savings</li>
                                <li>• Consider side income to accelerate building</li>
                              </>
                            )}
                            {finalScore >= 40 && finalScore < 80 && (
                              <>
                                <li>• Increase to 6 months of essential expenses</li>
                                <li>• Keep emergency funds in liquid, accessible accounts</li>
                                <li>• Review and adjust fund size annually</li>
                              </>
                            )}
                          </ul>
                        </div>
                      )}
                      
                      {finalScore < 60 && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mt-4">
                          <h4 className="text-yellow-400 font-medium text-sm mb-2">🚨 Emergency Funding Options (CFP Board):</h4>
                          <div className="space-y-1 text-xs text-gray-300">
                            <div className="flex items-start gap-2">
                              <span className="text-yellow-400 font-bold">1.</span>
                              <span>Taxable brokerage account</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-yellow-400 font-bold">2.</span>
                              <span>Cash equivalents (T-Bills, Money market)</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-yellow-400 font-bold">3.</span>
                              <span>Savings accounts</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-yellow-400 font-bold">4.</span>
                              <span>401(k) loan (up to 50% vested, max $50k)</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-yellow-400 font-bold">5.</span>
                              <span>401(k) hardship withdrawal (tax + 10% penalty)</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-yellow-400 font-bold">6.</span>
                              <span>HSA (20% penalty + tax if non-medical)</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-yellow-400 font-bold">7.</span>
                              <span>529 Plan (tax + 10% on earnings)</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-yellow-400 font-bold">8.</span>
                              <span>Life insurance loan</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
        
        </div>
      </div>
      
      {/* Row 3: Investment Analysis */}
      <div className="mb-12">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Investment Analysis</h2>
        
        {/* Combined Risk Profile & Asset Allocation Analysis */}
      <Card className="card-gradient border-gray-700 hover-lift mb-8">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-purple-400" />
            <div className="flex items-center justify-between w-full">
              <span>Investment Profile & Asset Allocation</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openQuickEdit('risk')}
                className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                title="Quick edit asset allocation"
              >
                <Edit3 className="w-3 h-3" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Risk Profile Section - Left */}
            <div className="lg:border-r border-gray-700 pr-6">
              <RiskProfileIndicator 
                profile={(snapRisk?.profile || profile?.userRiskProfile || profile?.calculations?.riskProfile || profile?.investor_risk_profile || 'Not Assessed') as any}
                score={snapRisk?.score ?? profile?.calculations?.riskScore}
                name="Your Risk Profile"
              />
            </div>

            {/* Current Allocation - Middle */}
            <div className="lg:border-r border-gray-700 px-6">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Current Allocation</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getCurrentAllocationData()}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      dataKey="value"
                      label={({ value }) => `${value}%`}
                      labelLine={false}
                    >
                      {getCurrentAllocationData().map((entry, index) => (
                        <Cell key={`current-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}%`, "Current"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {getCurrentAllocationData().map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-gray-300">{item.name}</span>
                    </div>
                    <span className="text-white font-medium">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Suggested Allocation - Right */}
            <div className="pl-6">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Suggested Allocation</h3>
              {((profile?.userRiskProfile || profile?.calculations?.riskProfile) === 'Not Assessed' || (!profile?.userRiskProfile && !profile?.calculations?.riskProfile)) ? (
                <div className="h-48 flex items-center justify-center">
                  <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                    <TrendingUp className="w-8 h-8 text-gray-500 mx-auto mb-3" />
                    <div className="text-gray-400 text-sm mb-2">Risk Profile Not Assessed</div>
                    <div className="text-gray-500 text-xs">Complete the investor risk questionnaire to see personalized allocation</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={getTargetAllocationData()}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          dataKey="value"
                          label={({ value }) => `${value}%`}
                          labelLine={false}
                        >
                          {getTargetAllocationData().map((entry, index) => (
                            <Cell key={`target-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value}%`, "Suggested"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2">
                    {getTargetAllocationData().map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                          <span className="text-gray-300">{item.name}</span>
                        </div>
                        <span className="text-white font-medium">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {(profile?.calculations?.riskProfile && profile?.calculations?.riskProfile !== 'Not Assessed') && (
                  <>
                    <div className="text-xs text-gray-400">
                      Portfolio Variance: <span className="text-white font-medium">
                        {Math.abs(
                          (getCurrentAllocationData().reduce((sum, item, i) => 
                            sum + Math.abs(item.value - getTargetAllocationData()[i]?.value || 0), 0
                          ) / getCurrentAllocationData().length)
                        ).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      Rebalance Needed: <span className={`font-medium ${
                        Math.abs(
                          (getCurrentAllocationData().reduce((sum, item, i) => 
                            sum + Math.abs(item.value - getTargetAllocationData()[i]?.value || 0), 0
                          ) / getCurrentAllocationData().length)
                        ) > 5 ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {Math.abs(
                          (getCurrentAllocationData().reduce((sum, item, i) => 
                            sum + Math.abs(item.value - getTargetAllocationData()[i]?.value || 0), 0
                          ) / getCurrentAllocationData().length)
                        ) > 5 ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div className="text-xs text-purple-300">
                {(!profile?.calculations?.riskProfile || profile?.calculations?.riskProfile === 'Not Assessed')
                  ? "Complete risk assessment for personalized recommendations"
                  : "Consult your financial advisor before making changes"
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Spouse Investment Profile & Asset Allocation - Only show if married and spouse data exists */}
      {profile?.maritalStatus === 'married' && profile?.spouseName && (
        <Card className="card-gradient border-gray-700 hover-lift mb-8">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-purple-400" />
              {profile.spouseName}'s Investment Profile & Asset Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Spouse Risk Profile Section - Left */}
              <div className="lg:border-r border-gray-700 pr-6">
                <RiskProfileIndicator 
                  profile={(profile?.spouseRiskProfile || profile?.calculations?.spouseRiskProfile || profile?.spouse_risk_profile || 'Not Assessed') as any}
                  score={profile?.calculations?.spouseRiskScore}
                  name={`${profile?.spouseName || 'Spouse'}'s Risk Profile`}
                />
              </div>

              {/* Spouse Current Allocation - Middle */}
              <div className="lg:border-r border-gray-700 px-6">
                <h3 className="text-sm font-medium text-gray-400 mb-4">Current Allocation</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getSpouseCurrentAllocationData()}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        dataKey="value"
                        label={({ value }) => `${value}%`}
                        labelLine={false}
                      >
                        {getSpouseCurrentAllocationData().map((entry, index) => (
                          <Cell key={`spouse-current-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value}%`, "Current"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {getSpouseCurrentAllocationData().map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span className="text-gray-300">{item.name}</span>
                      </div>
                      <span className="text-white font-medium">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Spouse Suggested Allocation - Right */}
              <div className="pl-6">
                <h3 className="text-sm font-medium text-gray-400 mb-4">Suggested Allocation</h3>
                {((profile?.spouseRiskProfile || profile?.calculations?.spouseRiskProfile) === 'Not Assessed' || (!profile?.spouseRiskProfile && !profile?.calculations?.spouseRiskProfile)) ? (
                  <div className="h-48 flex items-center justify-center">
                    <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                      <TrendingUp className="w-8 h-8 text-gray-500 mx-auto mb-3" />
                      <div className="text-gray-400 text-sm mb-2">Risk Profile Not Assessed</div>
                      <div className="text-gray-500 text-xs">Complete the spouse investor risk questionnaire to see personalized allocation</div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={getSpouseTargetAllocationData()}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            dataKey="value"
                            label={({ value }) => `${value}%`}
                            labelLine={false}
                          >
                            {getSpouseTargetAllocationData().map((entry, index) => (
                              <Cell key={`spouse-target-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`${value}%`, "Suggested"]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                      {getSpouseTargetAllocationData().map((item, index) => (
                        <div key={index} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                            <span className="text-gray-300">{item.name}</span>
                          </div>
                          <span className="text-white font-medium">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="mt-6 pt-6 border-t border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {((profile?.spouseRiskProfile || profile?.calculations?.spouseRiskProfile) && (profile?.spouseRiskProfile || profile?.calculations?.spouseRiskProfile) !== 'Not Assessed') && (
                    <>
                      <div className="text-xs text-gray-400">
                        Portfolio Variance: <span className="text-white font-medium">
                          {Math.abs(
                            (getSpouseCurrentAllocationData().reduce((sum, item, i) => 
                              sum + Math.abs(item.value - getSpouseTargetAllocationData()[i]?.value || 0), 0
                            ) / getSpouseCurrentAllocationData().length)
                          ).toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        Rebalance Needed: <span className={`font-medium ${
                          Math.abs(
                            (getSpouseCurrentAllocationData().reduce((sum, item, i) => 
                              sum + Math.abs(item.value - getSpouseTargetAllocationData()[i]?.value || 0), 0
                            ) / getSpouseCurrentAllocationData().length)
                          ) > 5 ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                          {Math.abs(
                            (getSpouseCurrentAllocationData().reduce((sum, item, i) => 
                              sum + Math.abs(item.value - getSpouseTargetAllocationData()[i]?.value || 0), 0
                            ) / getSpouseCurrentAllocationData().length)
                          ) > 5 ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <div className="text-xs text-purple-300">
                  {(!(profile?.spouseRiskProfile || profile?.calculations?.spouseRiskProfile) || (profile?.spouseRiskProfile || profile?.calculations?.spouseRiskProfile) === 'Not Assessed')
                    ? "Complete spouse risk assessment for personalized recommendations"
                    : "Spouse should consult their financial advisor before making changes"
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      
      {/* Value Teaser - Tax Strategies (show for everyone with high income) */}
      {((profile?.annualIncome || 0) + (profile?.spouseAnnualIncome || 0)) / 12 > 10000 && (
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ValueTeaserCard
            title="Optimize Your Tax Strategy"
            value="$15K-50K"
            description="Discover Roth conversion opportunities, tax-loss harvesting strategies, and deduction optimization tailored to your financial situation."
            linkTo="/tax-strategies"
            linkText="Explore Tax Strategies"
            icon="calculator"
          />
          <ValueTeaserCard
            title="Secure Your Legacy"
            value="92%"
            description="Create wills, trusts, and beneficiary strategies to protect your assets and ensure your wishes are carried out efficiently."
            linkTo="/estate-planning"
            linkText="Start Estate Planning"
            icon="shield"
          />
        </div>
      )}
      
      </div>
      
      {/* Row 4A: Retirement Analysis */}
      <div className="mb-12">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Retirement Analysis</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6">
          {/* Auto-calculating Retirement Success Widget */}
          <RetirementSuccessAuto />
          {/* Confidence Bands Widget */}
          <RetirementConfidenceEnhancedBands />
        </div>
      </div>
      

      {/* Comprehensive Insights Section - Enhanced analysis using ALL database data */}
      <ComprehensiveInsightsSection profile={profile} />

      {/* Value Teaser Section - Only show if user has completed profile */}
      {(profile?.calculations?.recommendations && profile.calculations.recommendations.length > 0) && (
        <div className="mb-8">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-white">Unlock Your Financial Potential</h3>
            <p className="text-gray-400 mt-2">Discover proven strategies to optimize your financial future</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Retirement Prep Center Teaser */}
            <ValueTeaserCard
              title="Retirement Optimization"
              value="12-15%"
              description="Average improvement in retirement success probability through our proven optimization strategies."
              linkTo="/retirement-prep"
              linkText="Boost Your Retirement Score"
              icon="trending"
              variant="accent"
            />
            
            {/* Roth Conversion Center Teaser */}
            <ValueTeaserCard
              title="Roth Conversion Savings"
              value="12%"
              description="Average lifetime tax savings through strategic Roth conversions and tax-efficient planning"
              linkTo="/tax-strategies"
              linkText="Start Saving on Taxes"
              icon="dollar"
              variant="accent"
            />
            
            {/* Social Security Optimization Teaser */}
            <ValueTeaserCard
              title="Social Security Optimization"
              value="10%"
              description="Average increase in lifetime income through strategic Social Security claiming strategies and timing optimization."
              linkTo="/retirement-planning?tab=social-security"
              linkText="Optimize Social Security"
              icon="dollar"
              variant="accent"
            />
          </div>
        </div>
      )}

      {/* Quick Edit Modal */}
      <QuickEditModal
        isOpen={quickEditModal.isOpen}
        onClose={() => setQuickEditModal({ isOpen: false, editType: null })}
        editType={quickEditModal.editType}
        currentData={profile}
        onSave={handleQuickEditSave}
      />

      {/* Row 7: Reset Financial Data */}
      <Card className="card-gradient border-red-700 bg-red-900/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Reset Your Financial Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 mb-4">
            Permanently delete all your financial information and start fresh. This will remove all intake form data, calculations, and recommendations while preserving your account.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                disabled={exporting}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {exporting ? 'Resetting Data...' : 'Reset All Financial Data'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-gray-900 border-gray-700">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white text-xl">
                  Are you sure you want to reset all your financial data?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-gray-300 space-y-3">
                  <p>This will permanently delete:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400">
                    <li>All intake form information</li>
                    <li>Financial calculations and scores</li>
                    <li>Asset and liability data</li>
                    <li>Goals and recommendations</li>
                    <li>Chat history</li>
                  </ul>
                  <p className="text-purple-300 font-medium mt-3">
                    Your login credentials will remain intact, but all other data will be permanently removed.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleResetFinancialData}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Yes, Reset All Data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
        </CardContent>
      </Card>
    </div>
  );
}
