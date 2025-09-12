import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  Area,
  AreaChart,
  ReferenceLine
} from 'recharts';
import { 
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { StressTestResponse, StressTestResult } from '@/../../shared/stress-test-types';

interface StressTestResultsProps {
  results: StressTestResponse;
  optimized?: boolean;
}

export const StressTestResults: React.FC<StressTestResultsProps> = ({ 
  results, 
  optimized = false 
}) => {
  const getSuccessLevel = (probability: number) => {
    if (probability >= 0.9) return { label: 'Excellent', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (probability >= 0.8) return { label: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    if (probability >= 0.7) return { label: 'Fair', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    if (probability >= 0.6) return { label: 'Poor', color: 'text-orange-600', bgColor: 'bg-orange-100' };
    return { label: 'Critical', color: 'text-red-600', bgColor: 'bg-red-100' };
  };

  const baselineLevel = getSuccessLevel(results.baseline.successProbability);
  const combinedLevel = results.combinedResult 
    ? getSuccessLevel(results.combinedResult.successProbability)
    : null;

  // Prepare data for radar chart (impact analysis)
  const radarData = results.individualResults.map(result => ({
    scenario: result.scenarioName.replace(/\s+\(.*\)/, ''),
    impact: Math.abs(result.impactPercentage),
    baseline: 0
  }));

  // Prepare waterfall data showing cumulative impact
  const waterfallData = results.individualResults
    .sort((a, b) => a.impactPercentage - b.impactPercentage)
    .reduce((acc, result, index) => {
      const prevValue = index === 0 
        ? results.baseline.successProbability * 100 
        : acc[index - 1].endValue;
      
      const change = result.successProbability * 100 - results.baseline.successProbability * 100;
      
      return [...acc, {
        name: result.scenarioName.replace(/\s+\(.*\)/, ''),
        startValue: prevValue,
        endValue: prevValue + change,
        change: change,
        isNegative: change < 0
      }];
    }, [] as any[]);

  // Add combined result to waterfall if available
  if (results.combinedResult && waterfallData.length > 0) {
    const lastValue = waterfallData[waterfallData.length - 1].endValue;
    const combinedChange = results.combinedResult.successProbability * 100 - lastValue;
    waterfallData.push({
      name: 'Interaction Effect',
      startValue: lastValue,
      endValue: results.combinedResult.successProbability * 100,
      change: combinedChange,
      isNegative: combinedChange < 0,
      isInteraction: true
    });
  }

  const mostImpactful = results.individualResults.reduce((prev, current) => 
    Math.abs(current.impactPercentage) > Math.abs(prev.impactPercentage) ? current : prev
  );

  const leastImpactful = results.individualResults.reduce((prev, current) => 
    Math.abs(current.impactPercentage) < Math.abs(prev.impactPercentage) ? current : prev
  );

  return (
    <div className="space-y-6">
      {/* Key Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Key Insights</CardTitle>
          <CardDescription>Critical findings from stress testing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Most Critical Risk:</strong> {mostImpactful.scenarioName} has the largest impact, 
              reducing success probability by {Math.abs(mostImpactful.impactPercentage).toFixed(1)}%
            </AlertDescription>
          </Alert>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Most Resilient Area:</strong> {leastImpactful.scenarioName} has minimal impact, 
              reducing success by only {Math.abs(leastImpactful.impactPercentage).toFixed(1)}%
            </AlertDescription>
          </Alert>

          {results.combinedResult && results.combinedResult.successProbability < 0.7 && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Action Required:</strong> Combined stress scenarios push success probability below 70%. 
                Consider adjusting retirement plans or building additional contingencies.
              </AlertDescription>
            </Alert>
          )}

          {results.combinedResult && results.combinedResult.successProbability >= 0.8 && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Strong Resilience:</strong> Your plan maintains {(results.combinedResult.successProbability * 100).toFixed(0)}% 
                success probability even under combined stress scenarios.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Detailed Charts */}
      <Tabs defaultValue="impact" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="impact">Impact Analysis</TabsTrigger>
          <TabsTrigger value="waterfall">Cumulative Impact</TabsTrigger>
        </TabsList>

        <TabsContent value="impact">
          <Card>
            <CardHeader>
              <CardTitle>Scenario Impact Analysis</CardTitle>
              <CardDescription>
                Relative impact of each stress scenario
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid strokeDasharray="3 3" />
                  <PolarAngleAxis 
                    dataKey="scenario" 
                    fontSize={12}
                    tick={{ fill: '#6b7280' }}
                  />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={[0, 'auto']}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Radar 
                    name="Impact (%)" 
                    dataKey="impact" 
                    stroke="#ef4444" 
                    fill="#ef4444" 
                    fillOpacity={0.6}
                  />
                  <Tooltip 
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    contentStyle={{ background: 'white', border: '1px solid #e5e7eb' }}
                  />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waterfall">
          <Card>
            <CardHeader>
              <CardTitle>Cumulative Impact Waterfall</CardTitle>
              <CardDescription>
                How each scenario progressively impacts success probability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={waterfallData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    height={100}
                    interval={0}
                    fontSize={12}
                  />
                  <YAxis 
                    domain={['dataMin - 5', 100]}
                    label={{ value: 'Success Probability (%)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    contentStyle={{ background: 'white', border: '1px solid #e5e7eb' }}
                  />
                  <ReferenceLine 
                    y={results.baseline.successProbability * 100} 
                    stroke="#10b981" 
                    strokeDasharray="3 3" 
                    label="Baseline"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="endValue" 
                    stroke="#ef4444" 
                    fill="#fecaca"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detailed Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Scenario Results</CardTitle>
          <CardDescription>
            Individual impact of each stress scenario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Scenario</th>
                  <th className="text-right py-2">Success Rate</th>
                  <th className="text-right py-2">Impact</th>
                  <th className="text-right py-2">Confidence Level</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 font-medium">Baseline</td>
                  <td className="text-right py-2">
                    {(results.baseline.successProbability * 100).toFixed(1)}%
                  </td>
                  <td className="text-right py-2">-</td>
                  <td className="text-right py-2">
                    <Badge className={`${baselineLevel.bgColor} ${baselineLevel.color} border-0`}>
                      {baselineLevel.label}
                    </Badge>
                  </td>
                </tr>
                {results.individualResults.map(result => {
                  const level = getSuccessLevel(result.successProbability);
                  return (
                    <tr key={result.scenarioId} className="border-b">
                      <td className="py-2">{result.scenarioName}</td>
                      <td className="text-right py-2">
                        {(result.successProbability * 100).toFixed(1)}%
                      </td>
                      <td className="text-right py-2">
                        <span className={result.impactPercentage < 0 ? 'text-red-600' : 'text-green-600'}>
                          {result.impactPercentage > 0 ? '+' : ''}
                          {result.impactPercentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-right py-2">
                        <Badge className={`${level.bgColor} ${level.color} border-0`}>
                          {level.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {results.combinedResult && (
                  <tr className="font-medium bg-gray-50">
                    <td className="py-2">Combined Stress</td>
                    <td className="text-right py-2 text-red-600">
                      {(results.combinedResult.successProbability * 100).toFixed(1)}%
                    </td>
                    <td className="text-right py-2 text-red-600">
                      {results.combinedResult.impactPercentage.toFixed(1)}%
                    </td>
                    <td className="text-right py-2">
                      <Badge className={`${combinedLevel!.bgColor} ${combinedLevel!.color} border-0`}>
                        {combinedLevel!.label}
                      </Badge>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};