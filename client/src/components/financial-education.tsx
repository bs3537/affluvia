import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BookOpen, 
  Trophy, 
  Star, 
  CheckCircle, 
  Lock, 
  Target,
  TrendingUp,
  Shield,
  DollarSign,
  PiggyBank,
  ArrowRight,
  Award
} from "lucide-react";

interface EducationModule {
  id: string;
  title: string;
  category: "basics" | "budgeting" | "investing" | "insurance" | "retirement" | "tax";
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedTime: number; // minutes
  points: number;
  prerequisites: string[];
  completed: boolean;
  unlocked: boolean;
  description: string;
  content: {
    overview: string;
    keyPoints: string[];
    cfpPrinciples: string[];
    practicalTips: string[];
    quiz?: {
      question: string;
      options: string[];
      correct: number;
      explanation: string;
    }[];
  };
}

interface UserProgress {
  totalPoints: number;
  level: number;
  completedModules: string[];
  currentStreak: number;
  achievements: string[];
}

interface FinancialEducationProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FinancialEducation({ isOpen, onClose }: FinancialEducationProps) {
  const [selectedModule, setSelectedModule] = useState<EducationModule | null>(null);
  const [progress, setProgress] = useState<UserProgress>({
    totalPoints: 0,
    level: 1,
    completedModules: [],
    currentStreak: 0,
    achievements: []
  });
  const [activeQuiz, setActiveQuiz] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);

  const educationModules: EducationModule[] = [
    {
      id: "financial-planning-basics",
      title: "Financial Planning Fundamentals",
      category: "basics",
      difficulty: "beginner",
      estimatedTime: 15,
      points: 100,
      prerequisites: [],
      completed: false,
      unlocked: true,
      description: "Learn the core principles of financial planning according to CFP Board standards",
      content: {
        overview: "Financial planning is a collaborative process that helps maximize a client's potential for meeting life goals through financial advice that integrates relevant elements of the client's personal and financial circumstances.",
        keyPoints: [
          "The financial planning process involves six key steps",
          "Understanding client goals and objectives is paramount",
          "Risk tolerance assessment drives investment recommendations",
          "Regular monitoring and adjustments are essential"
        ],
        cfpPrinciples: [
          "Act in the client's best interest (fiduciary duty)",
          "Maintain confidentiality and professionalism",
          "Provide competent and objective advice",
          "Exercise diligence in financial planning services"
        ],
        practicalTips: [
          "Start with emergency fund building (3-6 months expenses)",
          "Automate savings to build consistent habits",
          "Review and adjust plans annually or after major life events",
          "Document your financial goals with specific timelines"
        ],
        quiz: [
          {
            question: "What is the recommended emergency fund size according to CFP guidelines?",
            options: ["1-2 months expenses", "3-6 months expenses", "6-12 months expenses", "1 year expenses"],
            correct: 1,
            explanation: "CFP Board recommends 3-6 months of expenses for most individuals, with variations based on income stability and family situation."
          }
        ]
      }
    },
    {
      id: "budgeting-cash-flow",
      title: "Budgeting & Cash Flow Management",
      category: "budgeting",
      difficulty: "beginner",
      estimatedTime: 20,
      points: 150,
      prerequisites: ["financial-planning-basics"],
      completed: false,
      unlocked: false,
      description: "Master cash flow analysis and budgeting techniques used by financial planners",
      content: {
        overview: "Effective budgeting is the foundation of financial success. Understanding cash flow patterns helps identify opportunities for savings and investment.",
        keyPoints: [
          "Track all income and expenses accurately",
          "Use the 50/30/20 rule as a starting framework",
          "Identify areas for cost reduction and savings optimization",
          "Build budgets that align with long-term financial goals"
        ],
        cfpPrinciples: [
          "Cash flow management is essential for meeting financial objectives",
          "Regular monitoring prevents financial drift",
          "Budgeting should be realistic and sustainable",
          "Emergency planning requires consistent cash management"
        ],
        practicalTips: [
          "Use automated tools to track spending patterns",
          "Review monthly statements for accuracy",
          "Set up automatic transfers for savings goals",
          "Build in flexibility for unexpected expenses"
        ]
      }
    },
    {
      id: "investment-fundamentals",
      title: "Investment Strategy & Asset Allocation",
      category: "investing",
      difficulty: "intermediate",
      estimatedTime: 30,
      points: 200,
      prerequisites: ["financial-planning-basics", "budgeting-cash-flow"],
      completed: false,
      unlocked: false,
      description: "Learn professional investment strategies and portfolio construction principles",
      content: {
        overview: "Strategic asset allocation based on risk tolerance, time horizon, and financial goals is crucial for long-term investment success.",
        keyPoints: [
          "Diversification reduces portfolio risk without sacrificing returns",
          "Asset allocation should match investor risk profile",
          "Regular rebalancing maintains target allocations",
          "Cost minimization through low-fee investments improves returns"
        ],
        cfpPrinciples: [
          "Investment recommendations must suit client circumstances",
          "Risk tolerance assessment drives allocation decisions",
          "Fiduciary duty requires optimal investment selection",
          "Regular portfolio review ensures continued suitability"
        ],
        practicalTips: [
          "Start with low-cost index funds for diversification",
          "Rebalance quarterly or when allocations drift >5%",
          "Maximize tax-advantaged accounts first",
          "Consider target-date funds for hands-off investing"
        ]
      }
    },
    {
      id: "risk-management",
      title: "Insurance & Risk Management",
      category: "insurance",
      difficulty: "intermediate",
      estimatedTime: 25,
      points: 175,
      prerequisites: ["financial-planning-basics"],
      completed: false,
      unlocked: false,
      description: "Understand comprehensive risk management and insurance planning strategies",
      content: {
        overview: "Proper insurance coverage protects against financial catastrophe and ensures family financial security.",
        keyPoints: [
          "Life insurance needs analysis based on income replacement",
          "Disability insurance protects earning capacity",
          "Property insurance covers major assets",
          "Umbrella policies provide additional liability protection"
        ],
        cfpPrinciples: [
          "Risk management is fundamental to financial security",
          "Insurance needs change with life circumstances",
          "Cost-benefit analysis guides coverage decisions",
          "Regular policy reviews ensure adequate protection"
        ],
        practicalTips: [
          "Calculate life insurance as 10-12x annual income",
          "Ensure disability insurance covers 60-70% of income",
          "Review beneficiaries annually",
          "Consider umbrella policies for high net worth individuals"
        ]
      }
    },
    {
      id: "retirement-planning",
      title: "Retirement Planning Strategies",
      category: "retirement",
      difficulty: "advanced",
      estimatedTime: 35,
      points: 250,
      prerequisites: ["investment-fundamentals", "risk-management"],
      completed: false,
      unlocked: false,
      description: "Master retirement planning calculations and optimization strategies",
      content: {
        overview: "Retirement planning requires careful analysis of income needs, savings rates, and withdrawal strategies to ensure financial independence.",
        keyPoints: [
          "The 4% withdrawal rule provides initial guidance",
          "Social Security optimization strategies vary by situation",
          "Tax-efficient withdrawal sequences maximize income",
          "Healthcare costs require special planning consideration"
        ],
        cfpPrinciples: [
          "Retirement planning is a long-term process requiring regular updates",
          "Multiple income sources provide retirement security",
          "Tax planning is integral to retirement strategy",
          "Longevity risk requires conservative assumptions"
        ],
        practicalTips: [
          "Save at least 10-15% of income for retirement",
          "Maximize employer 401(k) matches",
          "Consider Roth conversions in low-income years",
          "Plan for 25-30 years of retirement income needs"
        ]
      }
    },
    {
      id: "tax-optimization",
      title: "Tax Planning & Optimization",
      category: "tax",
      difficulty: "advanced",
      estimatedTime: 30,
      points: 225,
      prerequisites: ["investment-fundamentals"],
      completed: false,
      unlocked: false,
      description: "Learn tax-efficient strategies for wealth building and preservation",
      content: {
        overview: "Strategic tax planning can significantly impact long-term wealth accumulation through timing and structure optimization.",
        keyPoints: [
          "Tax-loss harvesting reduces current tax burden",
          "Asset location optimization improves after-tax returns",
          "Retirement account sequencing minimizes lifetime taxes",
          "Estate planning reduces transfer taxes"
        ],
        cfpPrinciples: [
          "Tax efficiency enhances investment returns",
          "Planning should consider current and future tax situations",
          "Documentation is essential for tax strategies",
          "Regular review accounts for tax law changes"
        ],
        practicalTips: [
          "Maximize tax-deferred and tax-free account contributions",
          "Consider municipal bonds for high-income earners",
          "Time capital gains and losses strategically",
          "Use HSAs as retirement savings vehicles"
        ]
      }
    }
  ];

  // Update module unlock status based on progress
  useEffect(() => {
    const updatedModules = educationModules.map(module => ({
      ...module,
      completed: progress.completedModules.includes(module.id),
      unlocked: module.prerequisites.every(prereq => progress.completedModules.includes(prereq)) || module.prerequisites.length === 0
    }));
    
    // This would typically sync with backend
    // For now, just update local state
  }, [progress.completedModules]);

  const completeModule = (moduleId: string) => {
    const module = educationModules.find(m => m.id === moduleId);
    if (!module || progress.completedModules.includes(moduleId)) return;

    setProgress(prev => ({
      ...prev,
      totalPoints: prev.totalPoints + module.points,
      completedModules: [...prev.completedModules, moduleId],
      currentStreak: prev.currentStreak + 1,
      level: Math.floor((prev.totalPoints + module.points) / 500) + 1
    }));

    // Check for achievements
    checkAchievements(moduleId);
  };

  const checkAchievements = (moduleId: string) => {
    const newAchievements: string[] = [];
    
    if (progress.completedModules.length + 1 === 1) {
      newAchievements.push("first-steps");
    }
    if (progress.completedModules.length + 1 === 3) {
      newAchievements.push("getting-serious");
    }
    if (progress.completedModules.length + 1 === educationModules.length) {
      newAchievements.push("master-learner");
    }

    if (newAchievements.length > 0) {
      setProgress(prev => ({
        ...prev,
        achievements: [...prev.achievements, ...newAchievements]
      }));
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "basics": return <BookOpen className="w-4 h-4" />;
      case "budgeting": return <Target className="w-4 h-4" />;
      case "investing": return <TrendingUp className="w-4 h-4" />;
      case "insurance": return <Shield className="w-4 h-4" />;
      case "retirement": return <PiggyBank className="w-4 h-4" />;
      case "tax": return <DollarSign className="w-4 h-4" />;
      default: return <BookOpen className="w-4 h-4" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner": return "bg-green-500/10 text-green-400 border-green-500/20";
      case "intermediate": return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      case "advanced": return "bg-red-500/10 text-red-400 border-red-500/20";
      default: return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    }
  };

  const renderModuleCard = (module: EducationModule) => (
    <Card 
      key={module.id} 
      className={`cursor-pointer transition-all hover:bg-gray-800/70 ${
        module.unlocked ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-800/20 border-gray-800'
      }`}
      onClick={() => module.unlocked && setSelectedModule(module)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getCategoryIcon(module.category)}
            <CardTitle className={`text-sm ${module.unlocked ? 'text-white' : 'text-gray-500'}`}>
              {module.title}
            </CardTitle>
            {module.completed && <CheckCircle className="w-4 h-4 text-green-400" />}
            {!module.unlocked && <Lock className="w-4 h-4 text-gray-500" />}
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className={getDifficultyColor(module.difficulty)}>
            {module.difficulty}
          </Badge>
          <Badge variant="outline" className="bg-blue-500/10 text-sky-300 border-blue-500/20">
            {module.estimatedTime} min
          </Badge>
          <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
            {module.points} pts
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className={`text-xs ${module.unlocked ? 'text-gray-300' : 'text-gray-500'}`}>
          {module.description}
        </p>
      </CardContent>
    </Card>
  );

  const renderModuleContent = (module: EducationModule) => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedModule(null)}
          className="text-gray-400 hover:text-white"
        >
          ← Back to Modules
        </Button>
        <div className="flex gap-2">
          <Badge variant="outline" className={getDifficultyColor(module.difficulty)}>
            {module.difficulty}
          </Badge>
          <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
            {module.points} points
          </Badge>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-white mb-2">{module.title}</h3>
        <p className="text-gray-300 text-sm">{module.content.overview}</p>
      </div>

      <div>
        <h4 className="text-md font-medium text-white mb-2">Key Learning Points</h4>
        <ul className="space-y-1">
          {module.content.keyPoints.map((point, index) => (
            <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
              <Star className="w-3 h-3 text-yellow-400 mt-1 flex-shrink-0" />
              {point}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="text-md font-medium text-white mb-2">CFP Board Principles</h4>
        <ul className="space-y-1">
          {module.content.cfpPrinciples.map((principle, index) => (
            <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
              <Award className="w-3 h-3 text-blue-300 mt-1 flex-shrink-0" />
              {principle}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="text-md font-medium text-white mb-2">Practical Tips</h4>
        <ul className="space-y-1">
          {module.content.practicalTips.map((tip, index) => (
            <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
              <ArrowRight className="w-3 h-3 text-green-400 mt-1 flex-shrink-0" />
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {module.content.quiz && (
        <div>
          <h4 className="text-md font-medium text-white mb-2">Knowledge Check</h4>
          {module.content.quiz.map((question, qIndex) => (
            <Card key={qIndex} className="bg-gray-800/30 border-gray-700">
              <CardContent className="p-4">
                <p className="text-white text-sm mb-3">{question.question}</p>
                <div className="space-y-2">
                  {question.options.map((option, oIndex) => (
                    <Button
                      key={oIndex}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                      onClick={() => {
                        const newAnswers = [...quizAnswers];
                        newAnswers[qIndex] = oIndex;
                        setQuizAnswers(newAnswers);
                      }}
                    >
                      {String.fromCharCode(65 + oIndex)}. {option}
                    </Button>
                  ))}
                </div>
                {quizAnswers[qIndex] !== undefined && (
                  <div className="mt-3 p-2 bg-gray-700/50 rounded text-xs text-gray-300">
                    {quizAnswers[qIndex] === question.correct ? (
                      <span className="text-green-400">✓ Correct! </span>
                    ) : (
                      <span className="text-red-400">✗ Incorrect. </span>
                    )}
                    {question.explanation}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Button 
        onClick={() => completeModule(module.id)}
        disabled={module.completed}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {module.completed ? (
          <>
            <CheckCircle className="w-4 h-4 mr-2" />
            Completed
          </>
        ) : (
          <>
            Complete Module (+{module.points} points)
          </>
        )}
      </Button>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl h-[80vh] bg-gray-900 border-gray-700">
        <CardHeader className="border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-blue-300" />
              <div>
                <CardTitle className="text-white">Financial Education Center</CardTitle>
                <p className="text-sm text-gray-400">Learn from CFP Board standards and best practices</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
              ✕
            </Button>
          </div>
          
          {/* Progress Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-gray-800/50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-white">Level {progress.level}</span>
              </div>
              <p className="text-xs text-gray-400">{progress.totalPoints} points</p>
            </div>
            <div className="bg-gray-800/50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-sm text-white">{progress.completedModules.length}/{educationModules.length}</span>
              </div>
              <p className="text-xs text-gray-400">Modules completed</p>
            </div>
            <div className="bg-gray-800/50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-300" />
                <span className="text-sm text-white">{progress.currentStreak}</span>
              </div>
              <p className="text-xs text-gray-400">Current streak</p>
            </div>
            <div className="bg-gray-800/50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-white">{progress.achievements.length}</span>
              </div>
              <p className="text-xs text-gray-400">Achievements</p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0 h-full">
          <ScrollArea className="h-[calc(100%-200px)] p-6">
            {selectedModule ? (
              renderModuleContent(selectedModule)
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Available Modules</h3>
                <div className="grid gap-4">
                  {educationModules.map(renderModuleCard)}
                </div>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}