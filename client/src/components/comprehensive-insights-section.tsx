import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LastCalculated } from "@/components/ui/last-calculated";
import { useToast } from "@/hooks/use-toast";
import { 
  Lightbulb,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Target,
  Clock,
  TrendingUp
} from "lucide-react";
import { useDashboardSnapshot, pickWidget } from "@/hooks/useDashboardSnapshot";

interface ComprehensiveInsight {
  title: string;
  description: string;
  priority: number;
  category: string;
  actionSteps: string[];
  potentialImprovement: number;
  timeframe: string;
  quantifiedImpact: {
    dollarBenefit1Year: number;
    dollarBenefit5Years: number;
    dollarBenefitRetirement: number;
    healthScoreImprovement: number;
    riskReduction: number;
    compoundingValue: number;
  };
  benchmarkContext?: string;
  accountSpecific?: string;
  urgencyReason: string;
}

interface ComprehensiveInsightsSectionProps {
  profile?: any;
}

const ComprehensiveInsightsSection: React.FC<ComprehensiveInsightsSectionProps> = ({ profile }) => {
  const { toast } = useToast();
  const [insights, setInsights] = useState<ComprehensiveInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedInsights, setExpandedInsights] = useState<Set<number>>(new Set());
  const [hasGenerated, setHasGenerated] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const { data: snapshot } = useDashboardSnapshot();

  // Load existing comprehensive insights on mount (hydrate from snapshot first)
  useEffect(() => {
    const abortController = new AbortController();
    // Hydrate from snapshot if present
    try {
      const snap = pickWidget<any>(snapshot, 'dashboard_insights');
      if (snap && Array.isArray(snap.insights) && snap.insights.length > 0) {
        setInsights(snap.insights);
        setHasGenerated(true);
        if (snap.generatedAt) setGeneratedAt(snap.generatedAt);
        return () => abortController.abort();
      }
    } catch {}

    if (profile) {
      loadExistingInsights();
    }
    
    return () => {
      abortController.abort();
    };
  }, [profile, snapshot]);

  const loadExistingInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/comprehensive-insights', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.insights && Array.isArray(data.insights) && data.insights.length > 0) {
          setInsights(data.insights);
          setHasGenerated(true);
          const ts = data?.meta?.generatedAt || null;
          if (ts) setGeneratedAt(ts);
          console.log(`✅ Loaded ${data.insights.length} comprehensive insights`);
        } else {
          setInsights([]);
          setHasGenerated(false);
          setGeneratedAt(null);
        }
      } else {
        setInsights([]);
        setHasGenerated(false);
        setGeneratedAt(null);
      }
    } catch (error) {
      console.error('Error loading comprehensive insights:', error);
      setInsights([]);
      setHasGenerated(false);
    } finally {
      setLoading(false);
    }
  };

  const generateComprehensiveInsights = async () => {
    let timer: NodeJS.Timeout | null = null;
    try {
      setGenerating(true);
      setError(null);
      setElapsedTime(0);
      
      // Start timer
      const startTime = Date.now();
      timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      
      const response = await fetch('/api/comprehensive-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights || []);
        setHasGenerated(true);
        const ts = data?.meta?.generatedAt || null;
        if (ts) setGeneratedAt(ts); else setGeneratedAt(new Date().toISOString());
        
        toast({
          title: "Comprehensive Insights Generated",
          description: `Generated ${data.insights?.length || 0} insights from your complete financial profile.`,
        });
        
        console.log(`✅ Generated ${data.insights?.length || 0} comprehensive insights`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate comprehensive insights');
      }
    } catch (error) {
      console.error('Error generating comprehensive insights:', error);
      setError((error as Error).message || 'Failed to generate comprehensive insights');
      toast({
        title: "Error",
        description: "Failed to generate comprehensive insights. Please try again.",
        variant: "destructive"
      });
    } finally {
      if (timer) clearInterval(timer);
      setGenerating(false);
    }
  };

  const toggleInsightExpansion = (index: number) => {
    const newExpanded = new Set(expandedInsights);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedInsights(newExpanded);
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return "border-red-500/50 bg-red-500/5";
      case 2: return "border-yellow-500/50 bg-yellow-500/5";
      case 3: return "border-green-500/50 bg-green-500/5";
      default: return "border-gray-600/50 bg-gray-700/5";
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 1: return "Critical";
      case 2: return "Important";
      case 3: return "Optimization";
      default: return "Standard";
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    } else {
      return `$${amount.toLocaleString()}`;
    }
  };

  if (loading) {
    return (
      <Card className="card-gradient border-gray-700 mb-8">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            Comprehensive Financial Analysis
          </CardTitle>
          <p className="text-gray-400 text-sm">Loading existing insights...</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 text-purple-400 animate-spin mr-2" />
            <span className="text-gray-400">Loading comprehensive analysis...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-gradient border-gray-700 mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              Comprehensive Financial Analysis
            </CardTitle>
            <p className="text-gray-400 text-sm">
              {hasGenerated 
                ? "AI analysis of your complete financial profile" 
                : "Generate insights from your complete financial data"
              }
            </p>
          </div>
          <Button
            onClick={generateComprehensiveInsights}
            disabled={generating || !profile?.calculations}
            className="bg-[#B040FF] hover:bg-[#9333EA] text-white border-[#B040FF] hover:border-[#9333EA] disabled:bg-[#B040FF]/50 disabled:border-[#B040FF]/50 disabled:text-white/70"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : hasGenerated ? (
              "Regenerate Analysis"
            ) : (
              "Generate Comprehensive Insights"
            )}
          </Button>
        </div>
        {generatedAt && (
          <div className="mt-2">
            <LastCalculated timestamp={generatedAt} />
          </div>
        )}
      </CardHeader>

      <CardContent>
        {generating && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
              <h3 className="text-white font-medium mb-2">Analyzing Complete Financial Profile</h3>
              <p className="text-gray-400 text-sm">Processing all dashboard data, intake form, and financial calculations...</p>
              <div className="mt-4 text-sm text-gray-500">
                Elapsed time: <span className="text-purple-400 font-mono">{elapsedTime}s</span>
              </div>
            </div>
          </div>
        )}

        {error && !generating && (
          <div className="text-center py-6">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-400 mb-4">{error}</p>
            <Button 
              onClick={generateComprehensiveInsights} 
              className="bg-[#B040FF] hover:bg-[#9333EA] text-white"
            >
              Try Again
            </Button>
          </div>
        )}

        {!generating && !error && insights.length === 0 && !hasGenerated && (
          <div className="text-center py-8">
            <Target className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-white font-medium mb-2">Ready for Comprehensive Analysis</h3>
            <p className="text-gray-400 mb-4">
              Generate insights using your complete financial profile including all dashboard widgets, 
              intake form data, and calculations for the most accurate recommendations.
            </p>
          </div>
        )}

        {!generating && insights.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-400">
                <span className="text-white font-medium">{insights.length}</span> comprehensive insights
              </div>
              <div className="text-xs text-gray-500">
                Based on complete financial profile analysis
              </div>
            </div>

            {insights.map((insight, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${getPriorityColor(insight.priority)} transition-all duration-200`}
              >
                <div 
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => toggleInsightExpansion(index)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        insight.priority === 1 ? 'bg-red-500/20 text-red-400' :
                        insight.priority === 2 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {getPriorityLabel(insight.priority)}
                      </span>
                      <span className="text-xs text-gray-400 uppercase tracking-wide">
                        {insight.category}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {insight.timeframe}
                      </span>
                    </div>
                    
                    <h4 className="text-white font-medium mb-2">{insight.title}</h4>
                    <p className="text-gray-300 text-sm mb-3">{insight.description}</p>

                    {/* Impact Summary */}
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <div className="text-green-400 font-medium flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          1-Year Impact
                        </div>
                        <div className="text-white text-sm">
                          {formatCurrency(insight.quantifiedImpact?.dollarBenefit1Year || 0)}
                        </div>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <div className="text-blue-400 font-medium">5-Year Impact</div>
                        <div className="text-white text-sm">
                          {formatCurrency(insight.quantifiedImpact?.dollarBenefit5Years || 0)}
                        </div>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <div className="text-purple-400 font-medium">Score Improvement</div>
                        <div className="text-white text-sm">
                          +{insight.quantifiedImpact?.healthScoreImprovement || 0}%
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="ml-4">
                    {expandedInsights.has(index) ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedInsights.has(index) && (
                  <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-4">
                    {/* Action Steps */}
                    <div>
                      <h5 className="text-white font-medium mb-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        Action Steps
                      </h5>
                      <ul className="space-y-1">
                        {insight.actionSteps?.map((step, stepIndex) => (
                          <li key={stepIndex} className="text-gray-300 text-sm flex items-start gap-2">
                            <span className="text-gray-500 mt-1">•</span>
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Detailed Impact */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h6 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Long-term Benefits</h6>
                        <div className="space-y-1 text-sm">
                          <div className="text-gray-300">
                            Retirement Impact: {formatCurrency(insight.quantifiedImpact?.dollarBenefitRetirement || 0)}
                          </div>
                          <div className="text-gray-300">
                            Risk Reduction: {formatCurrency(insight.quantifiedImpact?.riskReduction || 0)}
                          </div>
                          <div className="text-gray-300">
                            Compounding Value: {formatCurrency(insight.quantifiedImpact?.compoundingValue || 0)}
                          </div>
                        </div>
                      </div>
                      <div>
                        <h6 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Context</h6>
                        <div className="space-y-1 text-sm">
                          {insight.benchmarkContext && (
                            <div className="text-gray-300">{insight.benchmarkContext}</div>
                          )}
                          {insight.accountSpecific && (
                            <div className="text-blue-300 italic">{insight.accountSpecific}</div>
                          )}
                          <div className="text-orange-300 text-xs mt-2">
                            <strong>Why now:</strong> {insight.urgencyReason}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="mt-6 p-4 rounded-lg bg-gray-800/50 border border-gray-700/50">
              <p className="text-xs text-gray-400 text-center">
                💡 These comprehensive insights analyze your complete financial profile including all dashboard widgets and calculations.
                AI can make mistakes. Always consult with a financial advisor before making significant financial decisions.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ComprehensiveInsightsSection;
