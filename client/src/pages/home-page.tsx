import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { Dashboard } from "@/components/dashboard";
import { IntakeForm } from "@/components/intake-form";
import { AIChatLayout } from "@/components/ai-chat-layout";
import { FloatingAIAssistant } from "@/components/floating-ai-assistant";
import { Settings } from "@/components/settings";
import { FinancialTipsSidebar } from "@/components/financial-tips-sidebar";
import { TaxReductionCenter } from "@/components/tax-reduction-center";
import { InvestmentsCenter } from "@/pages/InvestmentsCenter";
import { GoalsPlanningCenter } from "@/components/goals-planning-center";
import { EstatePlanningCenter } from "@/components/estate-planning-center";
import { EducationFundingCenter } from "@/components/education-funding-center";
import { LifeGoals } from "@/components/life-goals";
import RetirementPlanning from "@/pages/retirement-planning";
import { DebtManagementCenter } from "@/components/debt-management-center";
import { CentralInsights } from "@/components/central-insights";
import ReportBuilder from "@/pages/report-builder";
import Connections2 from "@/pages/connections2";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Menu, GraduationCap, DollarSign, Shield, PiggyBank, FileText, Calculator, Clock, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PersistentAchievementBar } from "@/components/gamification/persistent-achievement-bar";
import { useAchievements } from "@/hooks/useAchievements";
import { useAuth } from "@/hooks/use-auth";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

type ActiveView = "dashboard" | "connections2" | "intake" | "life-goals" | "chatbot" | "settings" | "education" | "retirement" | "tax" | "investments" | "goals" | "estate" | "educationfunding" | "retirement-planning" | "debt-management" | "insights" | "report-builder";

export default function HomePage() {
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [showFloatingAssistant, setShowFloatingAssistant] = useState(true);

  // Get user from auth context
  const { user } = useAuth();

  // Initialize achievement system
  const {
    progress,
    levelInfo,
    achievements,
    sectionProgress,
    recentAchievement,
    loading: achievementLoading
  } = useAchievements(user?.id || null);

  // Fetch user's financial profile for tips
  const { data: profile } = useQuery({
    queryKey: ["/api/financial-profile"],
    enabled: tipsOpen, // Fetch when tips sidebar is open
  });

  // Listen for navigation events from intake form and dashboard
  useEffect(() => {
    const handleNavigateToDashboard = () => {
      setActiveView("dashboard");
      setSidebarOpen(false);
    };
    
    const handleNavigateToRetirement = () => {
      setActiveView("retirement-planning");
      setSidebarOpen(false);
    };
    
    const handleNavigateToEducation = () => {
      setActiveView("educationfunding");
      setSidebarOpen(false);
    };
    
    const handleNavigateToDebtManagement = () => {
      setActiveView("debt-management");
      setSidebarOpen(false);
    };

    const handleNavigateToIntakeSection = (event: CustomEvent) => {
      setActiveView("intake");
      setSidebarOpen(false);
      
      // Dispatch event to intake form to jump to specific section
      setTimeout(() => {
        const sectionEvent = new CustomEvent('jumpToSection', {
          detail: { sectionType: event.detail.sectionType }
        });
        window.dispatchEvent(sectionEvent);
      }, 100);
    };

    const handleNavigateToIntake = () => {
      setActiveView('intake');
    };
    
    const handleNavigateToIntakeStep = (e: CustomEvent) => {
      setActiveView('intake');
      // Wait for intake form to mount, then navigate to specific step
      setTimeout(() => {
        const stepEvent = new CustomEvent('goToStep', { 
          detail: { step: e.detail.step }
        });
        window.dispatchEvent(stepEvent);
      }, 100);
    };

    window.addEventListener('navigateToDashboard', handleNavigateToDashboard);
    window.addEventListener('navigateToIntake', handleNavigateToIntake);
    window.addEventListener('navigateToIntakeSection', handleNavigateToIntakeSection as EventListener);
    window.addEventListener('navigateToIntakeStep', handleNavigateToIntakeStep as EventListener);
    window.addEventListener('navigateToRetirement', handleNavigateToRetirement);
    window.addEventListener('navigateToEducation', handleNavigateToEducation);
    window.addEventListener('navigateToDebtManagement', handleNavigateToDebtManagement);

    return () => {
      window.removeEventListener('navigateToDashboard', handleNavigateToDashboard);
      window.removeEventListener('navigateToIntake', handleNavigateToIntake);
      window.removeEventListener('navigateToIntakeSection', handleNavigateToIntakeSection as EventListener);
      window.removeEventListener('navigateToIntakeStep', handleNavigateToIntakeStep as EventListener);
      window.removeEventListener('navigateToRetirement', handleNavigateToRetirement);
      window.removeEventListener('navigateToEducation', handleNavigateToEducation);
      window.removeEventListener('navigateToDebtManagement', handleNavigateToDebtManagement);
    };
  }, []);

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":
        return <Dashboard />;
      case "connections2":
        return <Connections2 />;
      case "intake":
        return <IntakeForm />;
      case "life-goals":
        return <LifeGoals />;
      case "settings":
        return <Settings />;
      case "tax":
        return <TaxReductionCenter />;
      case "investments":
        return <InvestmentsCenter />;
      case "goals":
        return <GoalsPlanningCenter />;
      case "estate":
        return <EstatePlanningCenter />;
      case "retirement-planning":
        return <RetirementPlanning />;
      case "debt-management":
        return <DebtManagementCenter />;
      case "insights":
        return <CentralInsights />;
      case "report-builder":
        return <ReportBuilder />;
      case "education":
        return (
          <div className="p-4 lg:p-8 max-w-7xl mx-auto">
            <div className="bg-gradient-to-r from-purple-600/20 to-purple-800/20 rounded-xl p-6 mb-8 border border-purple-500/20">
              <div className="flex items-center gap-3 mb-4">
                <GraduationCap className="h-8 w-8 text-purple-400" />
                <div>
                  <h1 className="text-2xl font-bold text-white">CFP Board Education</h1>
                  <p className="text-purple-200">Professional financial planning guidelines aligned with CFP Board standards</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6">
              {/* Cash Flow & Budgeting */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-white">
                    <DollarSign className="h-6 w-6 text-green-400" />
                    Cash-Flow & Budgeting Discipline
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-700/30 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-400 mb-2">CFP Guideline</h4>
                    <p className="text-gray-300">
                      Dedicate at least 10-15% of take-home pay to savings; keep lifestyle + debt under ~70%.
                    </p>
                  </div>
                  
                </CardContent>
              </Card>

              {/* Emergency Fund */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-white">
                    <Shield className="h-6 w-6 text-orange-400" />
                    Emergency Fund
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-700/30 p-4 rounded-lg">
                    <h4 className="font-semibold text-orange-400 mb-2">CFP Guideline</h4>
                    <p className="text-gray-300">
                      Hold 3-6 months of essential expenses in a liquid account (more if job risk is high).
                    </p>
                  </div>
                  
                </CardContent>
              </Card>

              {/* Debt Management */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-white">
                    <Calculator className="h-6 w-6 text-red-400" />
                    Debt Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-700/30 p-4 rounded-lg">
                    <h4 className="font-semibold text-red-400 mb-2">CFP Guideline</h4>
                    <p className="text-gray-300">
                      Follow the 28/36 rule—housing ≤ 28% of gross income, total debt service ≤ 36%.
                    </p>
                  </div>
                  
                </CardContent>
              </Card>

              {/* Retirement Savings */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-white">
                    <PiggyBank className="h-6 w-6 text-purple-400" />
                    Retirement Savings Escalator
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-700/30 p-4 rounded-lg">
                    <h4 className="font-semibold text-purple-400 mb-2">CFP Guideline</h4>
                    <p className="text-gray-300">
                      Target 10-15% salary deferral into tax-advantaged retirement plans; auto-escalate 1% per year up to that cap.
                    </p>
                  </div>
                  
                </CardContent>
              </Card>

              {/* Risk Management */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-white">
                    <Shield className="h-6 w-6 text-cyan-400" />
                    Risk-Management Audit
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-700/30 p-4 rounded-lg">
                    <h4 className="font-semibold text-cyan-400 mb-2">CFP Guideline</h4>
                    <p className="text-gray-300">
                      Review core coverages—life, disability (prefer "own-occupation"), home/auto, and umbrella—annually.
                    </p>
                  </div>
                  
                </CardContent>
              </Card>

              {/* Tax-Efficient Planning */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-white">
                    <FileText className="h-6 w-6 text-yellow-400" />
                    Tax-Efficient Planning
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-700/30 p-4 rounded-lg">
                    <h4 className="font-semibold text-yellow-400 mb-2">CFP Guideline</h4>
                    <p className="text-gray-300">
                      Leverage workplace plans' auto-enroll/auto-escalate features (3% → 10-15%) and consider Roth vs. pre-tax diversification.
                    </p>
                  </div>
                  
                </CardContent>
              </Card>

              {/* Education Funding */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-white">
                    <GraduationCap className="h-6 w-6 text-indigo-400" />
                    Education Funding
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-700/30 p-4 rounded-lg">
                    <h4 className="font-semibold text-indigo-400 mb-2">CFP Guideline</h4>
                    <p className="text-gray-300">
                      Use 529 plans for college costs; capitalize on state tax perks, beneficiary flexibility, and tax-free growth.
                    </p>
                  </div>
                  
                </CardContent>
              </Card>

              {/* Estate Planning */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-white">
                    <FileText className="h-6 w-6 text-pink-400" />
                    Estate & Incapacity Readiness
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-700/30 p-4 rounded-lg">
                    <h4 className="font-semibold text-pink-400 mb-2">CFP Guideline</h4>
                    <p className="text-gray-300">
                      Maintain—at minimum—a will, financial & medical powers of attorney, and updated beneficiary designations.
                    </p>
                  </div>
                  
                </CardContent>
              </Card>

                            {/* Investment Management */}
                            <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-white">
                    <FileText className="h-6 w-6 text-yellow-400" />
                    Investment Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-700/30 p-4 rounded-lg">
                    <h4 className="font-semibold text-yellow-400 mb-2">CFP Guideline</h4>
                    <p className="text-gray-300">
                    Establish and maintain an asset allocation appropriate for your goals, risk tolerance, and time horizon.
                    </p>
                  </div>
                  
                </CardContent>
              </Card>

              {/* Holistic Monitoring */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-white">
                    <Clock className="h-6 w-6 text-teal-400" />
                    Holistic Monitoring (7-Step CFP Process)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gray-700/30 p-4 rounded-lg">
                    <h4 className="font-semibold text-teal-400 mb-2">CFP Guideline</h4>
                    <p className="text-gray-300">
                      Revisit goals, implementation, and progress at least annually in line with the CFP Board's 7-step planning cycle.
                    </p>
                  </div>
                  
                </CardContent>
              </Card>

              

              <div className="mt-8 p-6 bg-gradient-to-r from-purple-600/10 to-purple-800/10 rounded-lg border border-purple-500/20">
                <p className="text-gray-300 text-center">
                  <strong className="text-purple-400">These CFP-anchored rules give Affluvia a rock-solid, standards-based backbone</strong> while keeping advice concrete and measurable for every user session.
                </p>
              </div>
            </div>
          </div>
        );
      
      case "educationfunding":
        return <EducationFundingCenter />;

      default:
        return <Dashboard />;
    }
  };

  // Special handling for chatbot view
  if (activeView === "chatbot") {
    return (
      <div className="min-h-screen bg-gray-900">
        <AIChatLayout 
          onClose={() => setActiveView("dashboard")}
          activeView={activeView}
          setActiveView={setActiveView}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Achievement Bar - only show when user is logged in and data is loaded */}
      {user && !achievementLoading && (
        <PersistentAchievementBar
          userId={user.id.toString()}
          currentLevel={levelInfo?.level || 1}
          currentXP={levelInfo?.currentXP || 0}
          xpToNext={levelInfo?.xpToNext || 100}
          streakDays={progress?.currentStreak || 0}
          recentAchievement={recentAchievement}
          achievements={achievements}
          sectionProgress={sectionProgress}
        />
      )}

      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Desktop header */}
      <header className={`hidden lg:flex bg-gray-800 border-b border-gray-700 p-4 transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <div className="flex items-center justify-end w-full px-4">
          <NotificationCenter />
        </div>
      </header>

      {/* Mobile header */}
      <header className="lg:hidden bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="text-white"
          >
            <Menu className="h-6 w-6" />
          </Button>
          <NotificationCenter />
        </div>
      </header>

      {/* Main content */}
      <main className={`${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} min-h-screen transition-all duration-300 ease-in-out`}>
        {renderContent()}
      </main>

      {/* Financial Tips Sidebar */}
      <FinancialTipsSidebar 
        profile={profile}
        isOpen={tipsOpen}
        onClose={() => setTipsOpen(false)}
      />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Floating AI Assistant - only show when not in chatbot view */}
      {showFloatingAssistant && activeView !== "chatbot" && (
        <FloatingAIAssistant 
          onOpenChat={() => setActiveView("chatbot")}
        />
      )}
    </div>
  );
}
