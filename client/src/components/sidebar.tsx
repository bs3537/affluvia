import { Button } from "@/components/ui/button";
import { useState } from "react";
import { 
  TrendingUp, 
  LayoutDashboard, 
  ClipboardList, 
  MessageCircle, 
  X,
  GraduationCap,
  Target,
  Receipt,
  LineChart,
  BookOpen,
  Shield,
  School,
  Calculator,
  CreditCard,
  Sparkles,
  FileText,
  FolderSymlink,
  Link2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface SidebarProps {
  activeView: string;
  setActiveView: (view: "dashboard" | "connections2" | "intake" | "life-goals" | "chatbot" | "settings" | "education" | "tax" | "investments" | "goals" | "estate" | "estate-new" | "educationfunding" | "retirement-planning" | "debt-management" | "insights" | "report-builder" | "shared-vault") => void;
  isOpen: boolean;
  onClose: () => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ activeView, setActiveView, isOpen, onClose, onCollapsedChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const handleCollapseToggle = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapsedChange?.(newCollapsed);
  };
  
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "connections2", label: "Connections", icon: Link2 },
    { id: "intake", label: "Intake Form", icon: ClipboardList },
    { id: "life-goals", label: "Life Goals", icon: Target },
    { id: "investments", label: "Investment Picks", icon: LineChart },
    { id: "retirement-planning", label: "Retirement Planning", icon: Calculator },
    { id: "debt-management", label: "Debt Management", icon: CreditCard },
    { id: "tax", label: "Tax Strategies", icon: Receipt },
    // { id: "goals", label: "Goals Center", icon: Target, emoji: "🎯" }, // Temporarily disabled
    { id: "educationfunding", label: "Education Funding", icon: School },
    { id: "estate-new", label: "Estate Planning", icon: Shield },
    { id: "insights", label: "Insights", icon: Sparkles },
    { id: "chatbot", label: "Financial Assistant", icon: MessageCircle },
    { id: "education", label: "Financial Education", icon: GraduationCap },
    { id: "report-builder", label: "Report Generation", icon: FileText },
    { id: "shared-vault", label: "Vault", icon: FolderSymlink },
  ];

  const sidebarWidth = isCollapsed ? 'w-16' : 'w-64';

  return (
    <>
      <aside className={`fixed left-0 top-0 h-full ${sidebarWidth} bg-gray-800 border-r border-gray-700 transform transition-all duration-300 ease-in-out z-50 flex flex-col ${
        isOpen ? 'translate-x-0' : `-translate-x-full lg:translate-x-0`
      }`}>
        <div className={`${isCollapsed ? 'p-2' : 'p-6'} h-full flex flex-col transition-all duration-300`}>
          {/* Header with logo and collapse button */}
          <div className={`flex items-center justify-between mb-8 ${isCollapsed ? 'flex-col space-y-4' : ''}`}>
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
              <TrendingUp className={`w-8 h-8 text-[#B040FF] ${isCollapsed ? 'mr-0' : 'mr-3'}`} />
              {!isCollapsed && (
                <h1 className="text-xl font-bold text-white">AFFLUVIA</h1>
              )}
            </div>
            
            {/* Desktop collapse/expand button */}
            <div className="hidden lg:flex">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCollapseToggle}
                className="text-white hover:bg-gray-700 transition-colors"
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            {/* Mobile close button */}
            {!isCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="lg:hidden text-white hover:bg-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Navigation */}
          <nav className={`space-y-2 flex-1 overflow-y-auto ${isCollapsed ? 'overflow-x-hidden' : ''}`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              
              return (
                <div key={item.id} className="relative group">
                  <button
                    onClick={() => {
                      setActiveView(item.id as any);
                      if (!isCollapsed) onClose();
                    }}
                    className={`flex items-center w-full ${
                      isCollapsed ? 'px-2 py-3 justify-center' : 'px-4 py-3'
                    } rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-[#B040FF] text-white shadow-lg shadow-[#B040FF]/20'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    {(item as any).emoji ? (
                      <span className={`text-xl ${isCollapsed ? 'mr-0' : 'mr-3'}`}>
                        {(item as any).emoji}
                      </span>
                    ) : (
                      <Icon className={`w-5 h-5 ${isCollapsed ? 'mr-0' : 'mr-3'} ${
                        isActive ? 'text-white' : ''
                      }`} />
                    )}
                    
                    {!isCollapsed && (
                      <span className="whitespace-nowrap text-sm font-medium">
                        {item.label}
                      </span>
                    )}
                    
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#B040FF] rounded-r-full" />
                    )}
                  </button>
                  
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 border border-gray-700 shadow-lg">
                      {item.label}
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45 border-l border-b border-gray-700" />
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
