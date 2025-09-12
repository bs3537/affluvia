import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  X, 
  Loader2, 
  TrendingUp, 
  DollarSign,
  GraduationCap,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCcw,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

interface EducationGoal {
  id?: string;
  studentName: string;
  relationship?: string;
  goalType: 'college' | 'pre-college';
  startYear: number;
  endYear: number;
  years: number;
  costOption: 'average' | 'specific' | 'custom';
  collegeId?: string;
  collegeName?: string;
  costPerYear?: number;
  scholarshipPerYear?: number;
  loanPerYear?: number;
  coverPercent: number;
  currentSavings?: number;
  monthlyContribution?: number;
  projection?: {
    years: number[];
    costs: number[];
    funded: number[];
    totalCost: number;
    totalFunded: number;
    fundingPercentage: number;
    monthlyContributionNeeded: number;
    probabilityOfSuccess?: number;
  };
}

interface State529Info {
  state: string;
  maxDeduction: number;
  taxBenefit: string;
  specialFeatures: string[];
}

interface AIRecommendationsProps {
  goals: EducationGoal[];
  userState: string;
  onClose: () => void;
  selectedGoalId?: string;
}

interface RecommendationSection {
  title: string;
  icon: React.ElementType;
  points: string[];
  priority: 'high' | 'medium' | 'low';
}

export function AIRecommendations({ 
  goals, 
  userState, 
  onClose,
  selectedGoalId 
}: AIRecommendationsProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [recommendations, setRecommendations] = useState<string>('');
  const [parsedRecommendations, setParsedRecommendations] = useState<RecommendationSection[]>([]);

  // Get AI recommendations
  const { mutate: getRecommendations, isPending } = useMutation({
    mutationFn: async (goalId?: string) => {
      const endpoint = '/api/education/recommendations';
      const body = goalId ? { goalId } : { allGoals: true };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) throw new Error('Failed to get recommendations');
      return response.json();
    },
    onSuccess: (data) => {
      setRecommendations(data.recommendationText);
      parseRecommendations(data.recommendationText);
    },
    onError: (error) => {
      console.error('Error getting recommendations:', error);
      toast.error('Failed to generate recommendations');
    }
  });

  // Parse AI recommendations into structured sections
  const parseRecommendations = (text: string) => {
    const sections: RecommendationSection[] = [];
    
    // Parse savings strategy section
    const savingsMatch = text.match(/savings strategy|monthly savings?|contribute/i);
    if (savingsMatch) {
      const savingsPoints = text.split('\n')
        .filter(line => line.includes('$') && line.includes('month'))
        .map(line => line.trim());
      
      if (savingsPoints.length > 0) {
        sections.push({
          title: 'Savings Strategy',
          icon: DollarSign,
          points: savingsPoints,
          priority: 'high'
        });
      }
    }

    // Parse 529 plan recommendations
    const taxBenefitMatch = text.match(/529|tax.*benefit|state.*deduction/i);
    if (taxBenefitMatch) {
      const taxPoints = text.split('\n')
        .filter(line => line.match(/529|tax|deduct/i))
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      if (taxPoints.length > 0) {
        sections.push({
          title: 'Tax-Advantaged Savings',
          icon: TrendingUp,
          points: taxPoints,
          priority: 'high'
        });
      }
    }

    // Parse financial aid section
    const aidMatch = text.match(/financial aid|scholarship|FAFSA|grant/i);
    if (aidMatch) {
      const aidPoints = text.split('\n')
        .filter(line => line.match(/aid|scholarship|FAFSA|grant/i))
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      if (aidPoints.length > 0) {
        sections.push({
          title: 'Financial Aid & Scholarships',
          icon: GraduationCap,
          points: aidPoints,
          priority: 'medium'
        });
      }
    }

    // Parse warnings/considerations
    const warningMatch = text.match(/consider|ensure|don't|avoid|warning|important/i);
    if (warningMatch) {
      const warningPoints = text.split('\n')
        .filter(line => line.match(/consider|ensure|don't|avoid|retirement/i))
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      if (warningPoints.length > 0) {
        sections.push({
          title: 'Important Considerations',
          icon: AlertTriangle,
          points: warningPoints,
          priority: 'medium'
        });
      }
    }

    setParsedRecommendations(sections);
  };

  useEffect(() => {
    if (goals.length > 0) {
      getRecommendations(selectedGoalId);
    }
  }, [goals, selectedGoalId]);

  const selectedGoal = selectedGoalId 
    ? goals.find(g => g.id === selectedGoalId)
    : null;

  const totalEducationCost = goals.reduce((sum, goal) => 
    sum + (goal.projection?.totalCost || 0), 0
  );

  const totalFunded = goals.reduce((sum, goal) => 
    sum + (goal.projection?.totalFunded || 0), 0
  );

  const overallFundingPercentage = totalEducationCost > 0 
    ? Math.round((totalFunded / totalEducationCost) * 100) 
    : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-800 bg-gradient-to-r from-purple-900/20 to-purple-800/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Sparkles className="h-6 w-6 text-yellow-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    AI-Powered Education Funding Recommendations
                  </h2>
                  <p className="text-sm text-purple-200">
                    Personalized advice based on your {goals.length} education goal{goals.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <Button
                onClick={onClose}
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isPending ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-purple-400 mb-4" />
                <p className="text-gray-400">Analyzing your education goals...</p>
                <p className="text-sm text-gray-500 mt-2">Generating personalized recommendations</p>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-800/50">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-purple-600">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="recommendations" className="data-[state=active]:bg-purple-600">
                    Recommendations
                  </TabsTrigger>
                  <TabsTrigger value="action-items" className="data-[state=active]:bg-purple-600">
                    Action Items
                  </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-400">Total Education Cost</p>
                            <p className="text-2xl font-bold text-white">
                              ${totalEducationCost.toLocaleString()}
                            </p>
                          </div>
                          <DollarSign className="h-8 w-8 text-purple-400" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-400">Currently Funded</p>
                            <p className="text-2xl font-bold text-white">
                              ${totalFunded.toLocaleString()}
                            </p>
                          </div>
                          <TrendingUp className="h-8 w-8 text-green-400" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-400">Funding Status</p>
                            <p className="text-2xl font-bold text-white">
                              {overallFundingPercentage}%
                            </p>
                          </div>
                          {overallFundingPercentage >= 70 ? (
                            <CheckCircle className="h-8 w-8 text-green-400" />
                          ) : (
                            <AlertTriangle className="h-8 w-8 text-amber-400" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {selectedGoal && (
                    <Alert className="bg-purple-900/20 border-purple-500/20">
                      <Info className="h-4 w-4 text-purple-400" />
                      <AlertDescription className="text-purple-200">
                        Analyzing {selectedGoal.studentName}'s {selectedGoal.goalType} education goal 
                        starting in {selectedGoal.startYear}
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>

                {/* Recommendations Tab */}
                <TabsContent value="recommendations" className="space-y-6">
                  {parsedRecommendations.length > 0 ? (
                    parsedRecommendations.map((section, index) => (
                      <Card key={index} className="bg-gray-800/50 border-gray-700">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-white">
                            <section.icon className={`h-5 w-5 ${
                              section.priority === 'high' ? 'text-red-400' :
                              section.priority === 'medium' ? 'text-yellow-400' :
                              'text-blue-400'
                            }`} />
                            {section.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {section.points.map((point, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                                <span className="text-gray-300 text-sm">{point}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="prose prose-invert max-w-none">
                      <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                        <div dangerouslySetInnerHTML={{ __html: recommendations }} />
                      </div>
                    </div>
                  )}

                  <Alert className="bg-gray-800/50 border-gray-700">
                    <Info className="h-4 w-4 text-gray-400" />
                    <AlertDescription className="text-gray-400 text-xs">
                      This is general educational information based on your inputs, not personalized financial advice. 
                      Consult a licensed financial advisor for recommendations specific to your situation.
                    </AlertDescription>
                  </Alert>
                </TabsContent>

                {/* Action Items Tab */}
                <TabsContent value="action-items" className="space-y-4">
                  <Card className="bg-gray-800/50 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-white">Immediate Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {goals.map((goal) => {
                        const needsAction = goal.projection && goal.projection.fundingPercentage < 70;
                        return needsAction ? (
                          <div key={goal.id} className="p-4 bg-red-900/10 rounded-lg border border-red-500/20">
                            <h4 className="font-semibold text-red-400 mb-2">
                              {goal.studentName}'s Education Goal
                            </h4>
                            <ul className="space-y-1 text-sm text-gray-300">
                              <li>• Increase monthly savings to ${goal.projection?.monthlyContributionNeeded.toLocaleString()}</li>
                              <li>• Current funding: {goal.projection?.fundingPercentage}%</li>
                              <li>• Shortfall: ${((goal.projection?.totalCost || 0) - (goal.projection?.totalFunded || 0)).toLocaleString()}</li>
                            </ul>
                          </div>
                        ) : null;
                      })}

                      <div className="p-4 bg-green-900/10 rounded-lg border border-green-500/20">
                        <h4 className="font-semibold text-green-400 mb-2">
                          Tax-Advantaged Savings
                        </h4>
                        <ul className="space-y-1 text-sm text-gray-300">
                          <li>• Open or contribute to 529 plans for each education goal</li>
                          <li>• Research your state's specific tax benefits</li>
                          <li>• Consider age-based investment options</li>
                        </ul>
                      </div>

                      <div className="p-4 bg-blue-900/10 rounded-lg border border-blue-500/20">
                        <h4 className="font-semibold text-blue-400 mb-2">
                          Planning Steps
                        </h4>
                        <ul className="space-y-1 text-sm text-gray-300">
                          <li>• Complete FAFSA when eligible</li>
                          <li>• Research merit-based scholarships</li>
                          <li>• Review and adjust plans annually</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex justify-center">
                    <Button
                      onClick={() => getRecommendations(selectedGoalId)}
                      variant="outline"
                      className="border-purple-600 text-purple-400 hover:bg-purple-600/20"
                    >
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      Refresh Recommendations
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-800 bg-gray-900/80">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                className="border-gray-700 hover:bg-gray-800"
                disabled
              >
                <FileText className="h-4 w-4 mr-2" />
                Export Report (Coming Soon)
              </Button>
              <Button
                onClick={onClose}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Close
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}