import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, RefreshCw, Loader2, DollarSign, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface CentralInsight {
  id: string;
  priority: 1 | 2 | 3;
  title: string;
  explanation: string;
  estimatedImpact: number;
  category?: string;
  actionItems?: string[];
}

interface CentralInsightsResponse {
  insights: CentralInsight[];
  lastUpdated?: string | null;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
}

export function CentralInsights() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  const { data, isLoading, isError, error, refetch } = useQuery<CentralInsightsResponse>({
    queryKey: ['centralInsights', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/central-insights', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load insights');
      return res.json();
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/generate-central-insights', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to generate insights');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['centralInsights', user?.id] });
      refetch();
    }
  });

  const onRefresh = () => {
    setIsRefreshing(true);
    generateMutation.mutate(undefined, { onSettled: () => setIsRefreshing(false) });
  };

  // Seconds timer during any loading/generation state
  const isBusy = isLoading || isRefreshing || generateMutation.isPending;
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isBusy) {
      setElapsedSec(0);
      timer = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    } else {
      setElapsedSec(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isBusy]);

  const insights = data?.insights || [];
  const lastUpdated = data?.lastUpdated ? new Date(data.lastUpdated) : null;

  if (isLoading) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="py-16">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-purple-300" />
            <p className="mt-4 text-gray-300">Collecting your personalized insights… {elapsedSec}s</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Alert className="bg-red-900/20 border-red-800">
        <AlertDescription className="text-red-200">
          {error instanceof Error ? error.message : 'Failed to load insights'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-950 via-fuchsia-900 to-purple-950 border-fuchsia-700/60 shadow-lg shadow-fuchsia-900/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-300" />
              Insights
            </div>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <span className="text-xs text-purple-200/70">Updated {lastUpdated.toLocaleString()}</span>
              )}
              {(isRefreshing || generateMutation.isPending) && (
                <span className="text-xs text-purple-200/70">Generating… {elapsedSec}s</span>
              )}
              <Button size="sm" onClick={onRefresh} disabled={isRefreshing || generateMutation.isPending} className="bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 border border-purple-700/50">
                {isRefreshing || generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span className="ml-2">Refresh</span>
              </Button>
            </div>
          </CardTitle>
          <CardDescription className="text-purple-200/80">Your top AI-powered insights across all planning areas</CardDescription>
        </CardHeader>
      </Card>

      {/* Empty state */}
      {insights.length === 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="py-10 text-center">
            <Brain className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-300 mb-2">No insights yet</p>
            <p className="text-gray-500 mb-4">Generate a unified set of recommendations based on your full profile.</p>
            <div className="flex items-center justify-center gap-3">
              {(isRefreshing || generateMutation.isPending) && (
                <span className="text-sm text-purple-200/80">Generating… {elapsedSec}s</span>
              )}
              <Button onClick={onRefresh} disabled={isRefreshing || generateMutation.isPending} className="bg-[#8A00C4] hover:bg-[#7000A4] text-white">
                {isRefreshing || generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span className="ml-2">Generate Insights</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights list */}
      {insights.length > 0 && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((i) => (
            <Card key={i.id} className="bg-gray-800 border-gray-700">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-gray-900 rounded-lg">
                    <DollarSign className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-white">{i.title}</h4>
                      <div className="flex items-center gap-2">
                        {i.category && <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/50">{i.category}</Badge>}
                        <Badge className={
                          i.priority === 1 ? 'bg-red-500/20 text-red-300 border-red-500/50' :
                          i.priority === 2 ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' :
                          'bg-blue-500/20 text-blue-300 border-blue-500/50'
                        }>Priority {i.priority}</Badge>
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm mb-3">{i.explanation}</p>
                    {Array.isArray(i.actionItems) && i.actionItems.length > 0 && (
                      <ul className="list-disc list-inside text-gray-300 text-sm mb-3">
                        {i.actionItems.slice(0,5).map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    )}
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-green-400 font-semibold">Estimated Impact: {formatCurrency(i.estimatedImpact)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Legal disclaimer */}
        <div className="mt-6 text-xs text-gray-400">
          <p>
            Disclaimer: The insights provided are for educational purposes only and do not constitute financial, legal, or tax advice. Consult a qualified professional before making decisions.
          </p>
          <p className="mt-1">Note: AI can make mistakes. Please review all numbers and assumptions.</p>
        </div>
        </>
      )}
    </div>
  );
}
