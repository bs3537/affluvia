import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Lightbulb, X, TrendingUp, Shield, Target, DollarSign, PiggyBank, AlertTriangle, BookOpen, GraduationCap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface FinancialTip {
  id: string;
  title: string;
  description: string;
  category: "emergency" | "debt" | "investment" | "retirement" | "tax" | "insurance";
  priority: "high" | "medium" | "low";
  actionable: boolean;
  relatedMetric?: string;
  estimatedImpact?: string;
}

interface EducationTip {
  title: string;
  description: string;
  category: string;
  cfpPrinciple: string;
  actionTips: string[];
  difficulty: string;
}

interface FinancialTipsSidebarProps {
  profile: any;
  isOpen: boolean;
  onClose: () => void;
}

export function FinancialTipsSidebar({ profile, isOpen, onClose }: FinancialTipsSidebarProps) {
  const [dismissedTips, setDismissedTips] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("general");
  const [userLevel, setUserLevel] = useState<string>("beginner");

  // Fetch CFP Board-aligned education tips
  const { data: educationTips, isLoading: educationLoading } = useQuery({
    queryKey: ['/api/education-tips', selectedCategory, userLevel],
    queryFn: async () => {
      const response = await fetch(`/api/education-tips?category=${selectedCategory}&userLevel=${userLevel}`);
      if (!response.ok) throw new Error('Failed to fetch education tips');
      return response.json();
    },
    enabled: isOpen
  });
  
  const dismissTip = (tipId: string) => {
    setDismissedTips(prev => [...prev, tipId]);
  };

  const generateContextualTips = (): FinancialTip[] => {
    const tips: FinancialTip[] = [];
    const calculations = profile?.calculations;
    
    if (!calculations) return tips;

    // Emergency Fund Tips
    if (calculations.emergencyMonths < 3) {
      tips.push({
        id: "emergency-fund-low",
        title: "Build Your Emergency Fund",
        description: `You have ${calculations.emergencyMonths.toFixed(1)} months of expenses saved. Aim for 3-6 months to protect against unexpected costs.`,
        category: "emergency",
        priority: "high",
        actionable: true,
        relatedMetric: "Emergency Fund Score",
        estimatedImpact: "Reduces financial stress by 40%"
      });
    } else if (calculations.emergencyMonths >= 3 && calculations.emergencyMonths < 6) {
      tips.push({
        id: "emergency-fund-good",
        title: "Emergency Fund Progress",
        description: `Great start! You have ${calculations.emergencyMonths.toFixed(1)} months saved. Consider building to 6 months for optimal security.`,
        category: "emergency",
        priority: "medium",
        actionable: true,
        relatedMetric: "Emergency Fund Score"
      });
    }

    // Debt Management Tips
    const dtiRatio = (calculations.breakdown?.dtiScore || 0) < 70 ? "high" : "normal";
    if (dtiRatio === "high") {
      tips.push({
        id: "debt-reduction",
        title: "Debt-to-Income Optimization",
        description: "Your debt-to-income ratio could be improved. Consider the debt avalanche method: pay minimums on all debts, then extra on highest interest rate debt.",
        category: "debt",
        priority: "high",
        actionable: true,
        relatedMetric: "DTI Score",
        estimatedImpact: "Could save $200-500/month in interest"
      });
    }

    // Investment Tips based on Risk Profile
    const riskProfile = calculations.riskProfile;
    if (riskProfile && riskProfile !== 'Not Assessed') {
      const currentAllocation = profile.currentAllocation;
      const targetAllocation = calculations.targetAllocation;
      
      if (currentAllocation && targetAllocation) {
        const stocksDiff = Math.abs(
          (currentAllocation.usStocks + currentAllocation.intlStocks) - 
          (targetAllocation.usStocks + targetAllocation.intlStocks)
        );
        
        if (stocksDiff > 15) {
          tips.push({
            id: "portfolio-rebalance",
            title: "Portfolio Rebalancing Needed",
            description: `Your current allocation doesn't match your ${riskProfile} risk profile. Consider rebalancing to optimize returns.`,
            category: "investment",
            priority: "medium",
            actionable: true,
            relatedMetric: "Risk Profile",
            estimatedImpact: "Could improve returns by 1-2% annually"
          });
        }
      }
    }

    // Retirement Planning Tips
    if (calculations.retirementScore < 60) {
      tips.push({
        id: "retirement-boost",
        title: "Retirement Savings Acceleration",
        description: "Your retirement readiness could be stronger. Consider increasing contributions by just 1-2% annually to significantly improve your future.",
        category: "retirement",
        priority: "medium",
        actionable: true,
        relatedMetric: "Retirement Score",
        estimatedImpact: "Each 1% increase could add $100K+ by retirement"
      });
    }

    // Tax Optimization Tips
    if (profile.annualIncome && profile.annualIncome > 50000) {
      tips.push({
        id: "tax-strategy",
        title: "Tax-Advantaged Savings",
        description: "Maximize your 401(k) and IRA contributions to reduce current taxes while building retirement savings. Consider HSA if available.",
        category: "tax",
        priority: "medium",
        actionable: true,
        estimatedImpact: "Could save $2,000-8,000 annually in taxes"
      });
    }

    // Insurance Tips
    if (calculations.breakdown?.insuranceScore < 70) {
      tips.push({
        id: "insurance-review",
        title: "Insurance Coverage Gap",
        description: "Review your insurance coverage. Adequate life and disability insurance protect your family's financial future.",
        category: "insurance",
        priority: "medium",
        actionable: true,
        relatedMetric: "Insurance Score"
      });
    }

    // High Net Worth Tips
    if (calculations.netWorth > 500000) {
      tips.push({
        id: "wealth-optimization",
        title: "Wealth Management Strategy",
        description: "With your growing wealth, consider advanced strategies like tax-loss harvesting, estate planning, and diversified alternative investments.",
        category: "investment",
        priority: "low",
        actionable: true,
        relatedMetric: "Net Worth"
      });
    }

    return tips.filter(tip => !dismissedTips.includes(tip.id));
  };

  const tips = generateContextualTips();
  const highPriorityTips = tips.filter(tip => tip.priority === "high");
  const mediumPriorityTips = tips.filter(tip => tip.priority === "medium");
  const lowPriorityTips = tips.filter(tip => tip.priority === "low");

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "emergency": return <Shield className="w-4 h-4" />;
      case "debt": return <AlertTriangle className="w-4 h-4" />;
      case "investment": return <TrendingUp className="w-4 h-4" />;
      case "retirement": return <Target className="w-4 h-4" />;
      case "tax": return <DollarSign className="w-4 h-4" />;
      case "insurance": return <PiggyBank className="w-4 h-4" />;
      default: return <Lightbulb className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "emergency": return "bg-red-500/10 text-red-400 border-red-500/20";
      case "debt": return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "investment": return "bg-green-500/10 text-green-400 border-green-500/20";
      case "retirement": return "bg-blue-500/10 text-sky-300 border-blue-500/20";
      case "tax": return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "insurance": return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      default: return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-500/20 text-red-300 border-red-500/30";
      case "medium": return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      case "low": return "bg-green-500/20 text-green-300 border-green-500/30";
      default: return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
  };

  const renderTipSection = (sectionTips: FinancialTip[], title: string) => {
    if (sectionTips.length === 0) return null;

    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-300">{title}</h4>
        {sectionTips.map((tip) => (
          <Card key={tip.id} className="bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(tip.category)}
                  <CardTitle className="text-sm text-white">{tip.title}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissTip(tip.id)}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className={getCategoryColor(tip.category)}>
                  {tip.category}
                </Badge>
                <Badge variant="outline" className={getPriorityColor(tip.priority)}>
                  {tip.priority}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-gray-300 mb-2">{tip.description}</p>
              {tip.relatedMetric && (
                <p className="text-xs text-gray-400 mb-1">
                  Related: {tip.relatedMetric}
                </p>
              )}
              {tip.estimatedImpact && (
                <p className="text-xs text-green-400 font-medium">
                  Impact: {tip.estimatedImpact}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-gray-900 border-l border-gray-700 shadow-xl z-50 overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Your Financial Tips</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {!profile || !profile.calculations ? (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4 text-center">
              <BookOpen className="w-8 h-8 text-blue-300 mx-auto mb-2" />
              <p className="text-white font-medium">Get Started with Your Financial Tips</p>
              <p className="text-sm text-gray-400 mt-1">
                Please fill the intake form to get personalized finance tips to improve your financial health.
              </p>
            </CardContent>
          </Card>
        ) : tips.length === 0 ? (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4 text-center">
              <Lightbulb className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-white font-medium">Great Financial Health!</p>
              <p className="text-sm text-gray-400 mt-1">
                Your financial profile looks strong. Keep up the excellent work!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {renderTipSection(highPriorityTips, "Priority Actions")}
            {renderTipSection(mediumPriorityTips, "Optimization Opportunities")}
            {renderTipSection(lowPriorityTips, "Advanced Strategies")}
          </div>
        )}

        <div className="mt-6 p-3 bg-gray-800/30 rounded-lg border border-gray-700">
          <p className="text-xs text-gray-400 text-center">
            Tips are personalized based on your financial profile and update automatically as your situation changes.
          </p>
        </div>
      </div>
    </div>
  );
}