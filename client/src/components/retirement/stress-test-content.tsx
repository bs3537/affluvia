import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, ChevronRight, Shield, AlertTriangle, ChevronDown, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { StressTestScenarios } from './stress-test-scenarios';
import { StressTestOverview } from './stress-test-overview';
import { 
  StressScenario, 
  StressTestResponse 
} from '@/../../shared/stress-test-types';
import { useToast } from '@/hooks/use-toast';

interface StressTestContentProps {
  variables: any;
  hasOptimizedOnce: boolean;
  setActiveTab: (tab: string) => void;
  profile: any;
  optimizedScore: any;
  currentScore: any;
}

export const StressTestContent: React.FC<StressTestContentProps> = ({
  variables,
  hasOptimizedOnce,
  setActiveTab,
  profile,
  optimizedScore,
  currentScore
}) => {
  // Check if we have saved optimization data
  const hasOptimizedData = profile?.optimizationVariables?.hasOptimized || 
                          profile?.optimizationVariables?.optimizedScore || 
                          hasOptimizedOnce;
  
  // Initialize selected plan based on available data
  const [selectedPlan, setSelectedPlan] = useState<'baseline' | 'optimized'>(
    hasOptimizedData ? 'optimized' : 'baseline'
  );
  const [resultsBaseline, setResultsBaseline] = useState<StressTestResponse | null>(null);
  const [resultsOptimized, setResultsOptimized] = useState<StressTestResponse | null>(null);
  const [cachedResultsBaseline, setCachedResultsBaseline] = useState<StressTestResponse | null>(null);
  const [cachedResultsOptimized, setCachedResultsOptimized] = useState<StressTestResponse | null>(null);
  const [cacheAge, setCacheAge] = useState<number>(0);
  const [isCached, setIsCached] = useState(false);
  
  // Calculate baseline score early to avoid temporal dead zone
  const baselineScore = React.useMemo(() => {
    return selectedPlan === 'baseline' 
      ? (currentScore?.probabilityOfSuccess || 0)
      : (optimizedScore?.probabilityOfSuccess || 0);
  }, [selectedPlan, currentScore, optimizedScore]);
  
  // Current results based on selected plan
  const stressTestResults = selectedPlan === 'baseline' ? resultsBaseline : resultsOptimized;
  const cachedResults = selectedPlan === 'baseline' ? cachedResultsBaseline : cachedResultsOptimized;
  const setStressTestResults = selectedPlan === 'baseline' ? setResultsBaseline : setResultsOptimized;
  const setCachedResults = selectedPlan === 'baseline' ? setCachedResultsBaseline : setCachedResultsOptimized;
  const [isLoading, setIsLoading] = useState(false);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);
  const [showLastResults, setShowLastResults] = useState(true);
  const { toast } = useToast();
  
  // Load cached stress test results immediately on mount
  React.useEffect(() => {
    const loadCachedResults = async () => {
      try {
        const response = await fetch('/api/batch-stress-tests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ 
            useOptimizedVariables: selectedPlan === 'optimized',
            baselineScore: baselineScore,
            cacheOnly: true // Only get cached results
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.isCached) {
            // Transform batch results to stress test response format
            const cachedResponse: StressTestResponse = {
              individualResults: data.scenarios.map((s: any) => ({
                scenarioName: s.scenarioName,
                scenarioId: s.scenarioId,
                successProbability: s.stressedScore / 100,
                impact: s.impact,
                description: s.description
              })),
              combinedResult: null,
              baseline: {
                successProbability: data.baseline / 100,
                percentileCashFlows: {}
              },
              plan: selectedPlan,
              timestamp: Date.now() - (data.cacheAge * 1000)
            };
            setCachedResults(cachedResponse);
            setCacheAge(data.cacheAge || 0);
            setIsCached(true);
            
            // Also set as main results if we don't have any yet
            if (!stressTestResults) {
              setStressTestResults(cachedResponse);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load cached results:', error);
      }
    };

    loadCachedResults();
  }, [selectedPlan, baselineScore]);
  
  // Load last stress test results if available
  React.useEffect(() => {
    if (profile?.lastStressTestResults && showLastResults) {
      // Check if the results match the current plan
      const results = profile.lastStressTestResults;
      const resultsPlan = results.plan || 'baseline'; // Default to baseline for old results
      if (resultsPlan === selectedPlan && !cachedResults) {
        setStressTestResults(results);
      }
    }
  }, [profile, showLastResults, selectedPlan, cachedResults]);
  
  // Listen for optimization updates
  React.useEffect(() => {
    const handleOptimizationUpdate = () => {
      toast({
        title: "Optimization Updated",
        description: "New optimization detected. Re-run stress tests to see updated results.",
        action: (
          <Button
            size="sm"
            onClick={() => {
              setStressTestResults(null);
              setShowLastResults(false);
            }}
          >
            Clear Results
          </Button>
        ),
      });
    };
    
    window.addEventListener('retirementOptimizationUpdated', handleOptimizationUpdate);
    return () => window.removeEventListener('retirementOptimizationUpdated', handleOptimizationUpdate);
  }, [toast]);

  const handleScenarioToggleFromOverview = useCallback((scenarioId: string) => {
    setSelectedScenarios(prev => {
      if (prev.includes(scenarioId)) {
        return prev.filter(id => id !== scenarioId);
      } else {
        // Auto-expand configuration when a scenario is selected
        setIsConfigExpanded(true);
        return [...prev, scenarioId];
      }
    });
  }, []);

  const handleRunStressTest = useCallback(async (
    scenarios: StressScenario[], 
    runCombined: boolean
  ): Promise<StressTestResponse> => {
    setIsLoading(true);
    setShowLastResults(false); // We're running a new test
    
    try {
      // Prepare request body with updated field name
      const ov = selectedPlan === 'optimized' ? (profile?.optimizationVariables || variables) : undefined;
      const requestBody = {
        scenarios,
        runCombined,
        saveToProfile: true,
        forceRecalculate: true, // Bypass cache when running manually
        // Use new field name and correct variables
        optimizationVariables: ov
      };

      const response = await fetch('/api/stress-test-scenarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to run stress test');
      }

      const results = await response.json();
      
      // Confirm the response plan matches the selected plan
      if (results.plan && results.plan !== selectedPlan) {
        toast({
          title: "Plan Mismatch",
          description: `Expected ${selectedPlan} plan but got ${results.plan}. Re-running...`,
          variant: "destructive"
        });
        // Re-run with corrected parameters
        return handleRunStressTest(scenarios, runCombined);
      }
      
      setStressTestResults(results);
      
      toast({
        title: "Stress Test Complete",
        description: `Analyzed ${scenarios.filter(s => s.enabled).length} stress scenarios for ${selectedPlan} plan`,
      });
      
      return results;
    } catch (error) {
      console.error('Stress test error:', error);
      toast({
        title: "Stress Test Failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [selectedPlan, profile, toast]);

  // Check if Step 11 (retirement planning) is complete
  const hasBaselineData = profile?.retirementContributions !== undefined || 
                          profile?.expectedMonthlyExpensesRetirement !== undefined;
  
  if (!hasBaselineData) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-400" />
            Stress Test Analysis
          </CardTitle>
          <CardDescription className="text-gray-400">
            Test your retirement plan against various adverse scenarios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="bg-amber-900/20 border-amber-700">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-amber-200">
              Please complete Retirement Planning (Step 11) in your intake form to run stress tests.
            </AlertDescription>
          </Alert>
          <div className="mt-6 flex justify-center">
            <Button
              onClick={() => window.location.href = '/intake-form?step=11'}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              Complete Retirement Planning
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Show info message based on plan availability */}
      {selectedPlan === 'optimized' && !hasOptimizedData ? (
        <Alert className="bg-amber-900/20 border-amber-700">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-amber-200">
            No saved optimized plan yet. You can run baseline stress tests now or optimize your plan to compare. 
            <button 
              onClick={() => setActiveTab("optimize-score")}
              className="underline hover:text-amber-100 ml-1"
            >
              Go to Optimization tab
            </button> to create an optimized plan.
          </AlertDescription>
        </Alert>
      ) : null}
      
      {/* Plan Toggle */}
      <div className="text-center">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            onClick={() => {
              setSelectedPlan('baseline');
              setSelectedScenarios([]); // Clear selected scenarios
            }}
            className={`px-4 py-2 text-sm font-medium rounded-l-lg transition-all ${
              selectedPlan === 'baseline'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Baseline Plan
          </button>
          <button
            type="button"
            onClick={() => {
              if (hasOptimizedData) {
                setSelectedPlan('optimized');
                setSelectedScenarios([]); // Clear selected scenarios
              } else {
                toast({
                  title: "Optimized Plan Not Available",
                  description: "Please run optimization first to test the optimized plan",
                  variant: "destructive"
                });
              }
            }}
            disabled={!hasOptimizedData}
            className={`px-4 py-2 text-sm font-medium rounded-r-lg transition-all ${
              !hasOptimizedData 
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : selectedPlan === 'optimized'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title={!hasOptimizedData ? "Run optimization first to enable this option" : ""}
          >
            Optimized Plan
          </button>
        </div>
      </div>

      {/* Automatic Stress Test Overview - Shows immediately on load */}
      <StressTestOverview 
        selectedScenarios={selectedScenarios}
        onScenarioToggle={handleScenarioToggleFromOverview}
        useOptimizedPlan={selectedPlan === 'optimized'}
        baselineScore={baselineScore}
      />


      {/* Main Content - Collapsible Configuration */}
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardHeader 
          className="cursor-pointer select-none hover:bg-gray-800/30 transition-colors duration-200 rounded-t-lg"
          onClick={() => setIsConfigExpanded(!isConfigExpanded)}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl text-white">
                  Configure Retirement Success Scenarios
                </CardTitle>
                <motion.div
                  animate={{ rotate: isConfigExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <ChevronDown className="w-5 h-5" />
                </motion.div>
                {selectedScenarios.length > 0 && !isConfigExpanded && (
                  <span className="text-xs bg-purple-600/20 text-purple-300 px-2 py-1 rounded-full">
                    {selectedScenarios.length} selected
                  </span>
                )}
              </div>
              <CardDescription className="text-gray-400">
                {isConfigExpanded 
                  ? "Select and adjust stress scenarios to test your retirement success probability resilience"
                  : selectedScenarios.length > 0 
                    ? "Click to configure selected scenarios"
                    : "Click to expand configuration or select a scenario above"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <AnimatePresence initial={false}>
          {isConfigExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <CardContent className="space-y-6 pt-0">
                {/* Stress Test Scenarios */}
                <StressTestScenarios 
                  onRunStressTest={handleRunStressTest}
                  optimizationVariables={selectedPlan === 'optimized' ? variables : undefined}
                  selectedScenarios={selectedScenarios}
                  onScenarioSelectionChange={setSelectedScenarios}
                  baselineScore={baselineScore}
                  selectedPlan={selectedPlan}
                />
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          onClick={() => setActiveTab("optimize-score")}
          className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Optimization
        </Button>
        <Button
          onClick={() => setActiveTab("mc-withdrawals")}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
        >
          Next: Income
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};