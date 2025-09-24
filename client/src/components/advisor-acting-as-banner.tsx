import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command";
import { TrendingUp } from "lucide-react";

export function AdvisorActingAsBanner() {
  const { data } = useQuery({
    queryKey: ["/api/advisor/session"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/advisor/session", { credentials: "include" });
        if (!res.ok) return { isActingAs: false, client: null } as any;
        return await res.json();
      } catch {
        return { isActingAs: false, client: null } as any;
      }
    },
    staleTime: 5_000,
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/advisor/close-client", { method: 'POST', credentials: 'include' });
    },
    onSuccess: () => {
      window.location.href = "/advisor";
    }
  });

  // Load advisor's client list for quick switching (only when acting-as)
  const clientsQuery = useQuery({
    queryKey: ["/api/advisor/clients"],
    enabled: !!data?.isActingAs,
    queryFn: async () => {
      const res = await fetch("/api/advisor/clients", { credentials: "include" });
      if (!res.ok) return [] as any[];
      return await res.json();
    },
    staleTime: 15_000,
  });

  const switchMutation = useMutation({
    mutationFn: async (clientId: number) => {
      await fetch(`/api/advisor/open-client/${clientId}`, { method: 'POST', credentials: 'include' });
    },
    onSuccess: () => {
      window.location.href = "/";
    }
  });

  useEffect(() => {
    if (data?.isActingAs) {
      document.body.classList.add('advisor-acting-as');
    } else {
      document.body.classList.remove('advisor-acting-as');
    }
    return () => {
      document.body.classList.remove('advisor-acting-as');
    };
  }, [data?.isActingAs]);

  if (!data?.isActingAs) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] gradient-bg text-white border-b border-purple-500/40">
      <div className="w-full px-4 py-2 lg:pl-20 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-white">
            <TrendingUp className="h-5 w-5" />
            <span className="text-base font-semibold tracking-wide uppercase">Affluvia</span>
          </div>
          <div className="text-sm text-white/90">
            Advisor Mode — Viewing <strong>{data.client?.fullName || data.client?.email}</strong>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {Array.isArray(clientsQuery.data) && clientsQuery.data.length > 0 && (
            <SwitchClient clients={clientsQuery.data} currentId={data.client?.id} onSwitch={(id) => switchMutation.mutate(id)} />
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => closeMutation.mutate()}
            className="text-white bg-gray-900/40 border border-[#8A00C4] hover:bg-[#8A00C4] hover:text-white"
          >
            Back to Advisor Portal
          </Button>
        </div>
      </div>
    </div>
  );
}

function SwitchClient({ clients, currentId, onSwitch }: { clients: any[]; currentId?: number; onSwitch: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} className="bg-white/10 text-white border border-white/20 hover:bg-white/20">
        Switch Client
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search clients…" />
        <CommandList>
          <CommandEmpty>No clients found.</CommandEmpty>
          {clients.map((c) => (
            <CommandItem
              key={c.id}
              onSelect={() => {
                if (c.id !== currentId) onSwitch(c.id);
                setOpen(false);
              }}
            >
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-purple-600/20 border border-purple-500/40 text-xs">
                {(c.fullName || c.email || '?').slice(0,1).toUpperCase()}
              </span>
              <span className="text-sm">{c.fullName || c.email}</span>
              {c.id === currentId && <span className="ml-auto text-xs opacity-60">current</span>}
            </CommandItem>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
