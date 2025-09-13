import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingDown, 
  TrendingUp, 
  Heart, 
  Activity, 
  Shield, 
  Receipt, 
  BarChart, 
  Clock,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { 
  StressScenario, 
  DEFAULT_STRESS_SCENARIOS,
  StressTestResponse 
} from '@/../../shared/stress-test-types';

interface StressTestScenariosProps {
  onRunStressTest: (scenarios: StressScenario[], runCombined: boolean) => Promise<StressTestResponse>;
  optimizationVariables?: any;
  selectedScenarios?: string[];
  onScenarioSelectionChange?: (scenarioIds: string[]) => void;
  baselineScore?: number;
  selectedPlan?: 'baseline' | 'optimized';
}

const iconMap: Record<string, React.ElementType> = {
  TrendingDown,
  TrendingUp,
  Heart,
  Activity,
  Shield,
  Receipt,
  BarChart,
  Clock
};

export const StressTestScenarios: React.FC<StressTestScenariosProps> = ({ 
  onRunStressTest,
  optimizationVariables,
  selectedScenarios = [],
  onScenarioSelectionChange,
  baselineScore = 0,
  selectedPlan = 'optimized'
}) => {
  // Initialize scenarios with enabled state based on selectedScenarios
  const [scenarios, setScenarios] = useState<StressScenario[]>(() => 
    DEFAULT_STRESS_SCENARIOS.map(scenario => ({
      ...scenario,
      enabled: selectedScenarios.includes(scenario.id)
    }))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [runningSeconds, setRunningSeconds] = useState(0);
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [runCombined, setRunCombined] = useState(true);

  // Update scenarios when selectedScenarios prop changes
  React.useEffect(() => {
    setScenarios(prev => prev.map(scenario => ({
      ...scenario,
      enabled: selectedScenarios.includes(scenario.id)
    })));
  }, [selectedScenarios]);

  const handleToggleScenario = useCallback((scenarioId: string) => {
    const newScenarios = scenarios.map(scenario => 
      scenario.id === scenarioId 
        ? { ...scenario, enabled: !scenario.enabled }
        : scenario
    );
    setScenarios(newScenarios);
    
    // Update parent component with new selection
    if (onScenarioSelectionChange) {
      const selectedIds = newScenarios
        .filter(s => s.enabled)
        .map(s => s.id);
      onScenarioSelectionChange(selectedIds);
    }
  }, [scenarios, onScenarioSelectionChange]);

  const handleValueChange = useCallback((scenarioId: string, value: number) => {
    setScenarios(prev => prev.map(scenario => 
      scenario.id === scenarioId 
        ? { ...scenario, parameters: { ...scenario.parameters, value } }
        : scenario
    ));
  }, []);

  const handleRunStressTest = async () => {
    const enabledScenarios = scenarios.filter(s => s.enabled);
    
    if (enabledScenarios.length === 0) {
      setError('Please enable at least one stress scenario');
      return;
    }

    setIsRunning(true);
    setRunningSeconds(0);
    setCurrentScenarioIndex(0);
    setError(null);
    
    try {
      // Start a simple progress ticker cycling through enabled scenario names
      const names = enabledScenarios.map(s => s.name);
      const ticker = setInterval(() => {
        setRunningSeconds(prev => prev + 1);
        if (names.length > 0) {
          setCurrentScenarioIndex(prev => (prev + 1) % names.length);
        }
      }, 1000);
      const response = await onRunStressTest(scenarios, runCombined);
      // Don't store results here, let the parent handle it
      clearInterval(ticker);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run stress test');
    } finally {
      setIsRunning(false);
      setRunningSeconds(0);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'market': return 'text-red-600';
      case 'inflation': return 'text-orange-600';
      case 'longevity': return 'text-purple-600';
      case 'costs': return 'text-yellow-600';
      case 'income': return 'text-blue-600';
      case 'timing': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const formatValue = (value: number, unit: string) => {
    switch (unit) {
      case 'percentage':
        return value > 0 ? `+${value}%` : `${value}%`;
      case 'years':
        return value > 0 ? `+${value} years` : `${value} years`;
      case 'amount':
        return value > 0 ? `+$${value.toLocaleString()}` : `-$${Math.abs(value).toLocaleString()}`;
      default:
        return value.toString();
    }
  };

  const enabledCount = scenarios.filter(s => s.enabled).length;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Retirement Success Scenarios Configuration</CardTitle>
          <CardDescription className="text-gray-400">
            Select and configure stress scenarios to test your retirement success probability resilience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="run-combined" className="text-white">Run Combined Stress Test</Label>
              <p className="text-sm text-gray-400">
                Test all enabled scenarios together for cumulative impact
              </p>
            </div>
            <Switch
              id="run-combined"
              checked={runCombined}
              onCheckedChange={setRunCombined}
              disabled={enabledCount < 2}
            />
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t border-gray-700">
            <div>
              <p className="text-sm font-medium text-white">
                {enabledCount} scenario{enabledCount !== 1 ? 's' : ''} enabled
              </p>
              {enabledCount > 0 && runCombined && enabledCount > 1 && (
                <p className="text-xs text-gray-400">
                  Will run {enabledCount} individual + 1 combined test
                </p>
              )}
              {isRunning && enabledCount > 0 && (
                <p className="text-xs text-gray-300 mt-1">
                  Analyzing impact of each stress test scenario... {runningSeconds}s
                  {(() => {
                    const names = scenarios.filter(s => s.enabled).map(s => s.name);
                    const name = names.length ? names[currentScenarioIndex % names.length] : '';
                    return name ? ` (running ${name})` : '';
                  })()}
                </p>
              )}
            </div>
            <Button 
              onClick={handleRunStressTest}
              disabled={isRunning || enabledCount === 0}
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Simulations...
                </>
              ) : (
                'Run Stress Test'
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Scenario Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {scenarios.map(scenario => {
          const Icon = iconMap[scenario.icon || 'AlertTriangle'] || AlertTriangle;
          
          return (
            <Card 
              key={scenario.id} 
              className={`bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 transition-all ${
                scenario.enabled 
                  ? 'ring-2 ring-purple-500 shadow-lg shadow-purple-500/20' 
                  : 'opacity-60'
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Icon className={`h-5 w-5 ${getCategoryColor(scenario.category)}`} />
                    <CardTitle className="text-base text-white">{scenario.name}</CardTitle>
                  </div>
                  <Switch
                    checked={scenario.enabled}
                    onCheckedChange={() => handleToggleScenario(scenario.id)}
                  />
                </div>
                <CardDescription className="text-xs text-gray-400">
                  {scenario.description}
                </CardDescription>
              </CardHeader>
              
              {scenario.enabled && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-white">Stress Level</Label>
                      <span className="text-sm font-medium text-white">
                        {formatValue(scenario.parameters.value, scenario.parameters.unit)}
                      </span>
                    </div>
                    <Slider
                      value={[scenario.parameters.value]}
                      onValueChange={([value]) => handleValueChange(scenario.id, value)}
                      min={scenario.parameters.min}
                      max={scenario.parameters.max}
                      step={scenario.parameters.step}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{formatValue(scenario.parameters.min!, scenario.parameters.unit)}</span>
                      <span>{formatValue(scenario.parameters.max!, scenario.parameters.unit)}</span>
                    </div>
                  </div>
                  
                  {scenario.parameters.timing && (
                    <div className="pt-2 border-t border-gray-700">
                      <p className="text-xs text-gray-400">
                        Timing: <span className="font-medium capitalize text-gray-300">{scenario.parameters.timing}</span>
                      </p>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

    </div>
  );
};
