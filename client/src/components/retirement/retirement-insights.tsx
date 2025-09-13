import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, RefreshCw, Loader2, DollarSign, AlertTriangle, Info } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface RetirementInsight {
  id: string;
  priority: 1 | 2 | 3;
  title: string;
  explanation?: string; // legacy support
  action?: string;
  why?: string;
  estimatedImpact: number; // dollars
}

interface RetirementInsightsResponse {
  insights: RetirementInsight[];
  lastUpdated?: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount || 0);
}

export function RetirementInsights() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, isError, refetch, error } = useQuery<RetirementInsightsResponse>({
    queryKey: ['retirementInsights', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/retirement-insights', { credentials: 'include' });
      if (res.status === 404) {
        // Treat not-found as empty state rather than an error
        return { insights: [], lastUpdated: null } as RetirementInsightsResponse;
      }
      if (!res.ok) throw new Error('Failed to load retirement insights');
      return res.json();
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/generate-retirement-insights', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to generate insights');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retirementInsights', user?.id] });
      refetch();
    },
  });

  const onRefresh = () => {
    setIsRefreshing(true);
    generateMutation.mutate(undefined, {
      onSettled: () => setIsRefreshing(false),
    });
  };

  if (isLoading) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="py-16">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-purple-300" />
            <p className="mt-4 text-gray-300">Preparing your retirement insights…</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Alert className="bg-red-900/20 border-red-800">
        <AlertTriangle className="h-4 w-4 text-red-400" />
        <AlertDescription className="text-red-200">
          {error instanceof Error ? error.message : 'Failed to load retirement insights'}
        </AlertDescription>
      </Alert>
    );
  }

  const insights = data?.insights || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-950 via-fuchsia-900 to-purple-950 border-fuchsia-700/60 shadow-lg shadow-fuchsia-900/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-6 h-6 text-purple-300" />
              Retirement Insights
            </div>
            <Button
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing || generateMutation.isPending}
              className="bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 border border-purple-700/50"
            >
              {isRefreshing || generateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="ml-2">Refresh</span>
            </Button>
          </CardTitle>
          <CardDescription className="text-purple-200/80">
            Top prioritized insights based on your saved retirement analysis
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Empty state */}
      {insights.length === 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="py-10 text-center">
            <Info className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-300 mb-2">No insights yet</p>
            <p className="text-gray-500 mb-4">Generate personalized insights based on your retirement data.</p>
            <Button onClick={onRefresh} disabled={isRefreshing || generateMutation.isPending} className="bg-[#8A00C4] hover:bg-[#7000A4] text-white">
              {isRefreshing || generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-2">Generate Insights</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Insights List */}
      {insights.length > 0 && (
        <div className="space-y-4">
          {insights.map((insight) => (
            <Card key={insight.id} className="bg-gray-800 border-gray-700">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-gray-900 rounded-lg">
                    <DollarSign className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-white">{insight.title}</h4>
                      <Badge className={
                        insight.priority === 1 ? 'bg-red-500/20 text-red-300 border-red-500/50' :
                        insight.priority === 2 ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' :
                        'bg-blue-500/20 text-blue-300 border-blue-500/50'
                      }>
                        Priority {insight.priority}
                      </Badge>
                    </div>
                    {insight.action && (
                      <p className="text-gray-200 text-sm mb-1"><span className="font-medium text-gray-100">Action:</span> {insight.action}</p>
                    )}
                    <p className="text-gray-300 text-sm mb-3">
                      <span className="font-medium text-gray-200">Why it matters:</span> {insight.why || insight.explanation}
                    </p>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-green-400 font-semibold">Estimated Impact: {formatCurrency(insight.estimatedImpact)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
