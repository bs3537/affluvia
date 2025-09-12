import { useQuery } from '@tanstack/react-query';

export type SnapshotWidget = {
  id: string;
  version: string;
  data: any;
  updatedAt: string;
};

export type DashboardSnapshot = {
  userId: number;
  scenarioHash: string;
  modelVersion: string;
  createdAt: string;
  widgets: SnapshotWidget[];
  meta: { hasPlaidSnapshot: boolean; source: 'cache' | 'fresh' };
};

export function useDashboardSnapshot() {
  return useQuery<DashboardSnapshot | null>({
    queryKey: ['api/dashboard-snapshot'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard-snapshot', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: 'always',
  });
}

export function pickWidget<T = any>(snapshot: DashboardSnapshot | null | undefined, id: string): T | null {
  if (!snapshot || !Array.isArray(snapshot.widgets)) return null;
  const w = snapshot.widgets.find(w => w.id === id);
  return (w && w.data) ? (w.data as T) : null;
}
