import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { ArrowUpDown, Search, TrendingUp, Users, Mail, Clock, RefreshCw, Trash, X, Eye, ExternalLink, Paintbrush } from "lucide-react";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { 
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from "@/components/ui/alert-dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";

const DEFAULT_ADVISOR_DISCLAIMER = `IMPORTANT DISCLOSURES

For Informational Purposes Only — The information provided through this platform is for educational and informational purposes only and does not constitute personalized investment advice, legal advice, tax advice, or a recommendation to buy or sell any security. Any investment decisions you make are your sole responsibility.

No Guarantee of Outcomes — Financial projections (including Monte Carlo analyses and scenario modeling) are based on assumptions believed to be reasonable as of the date produced but are not guarantees of future performance or outcomes. Investment returns, inflation, tax laws, and market conditions are uncertain and may differ materially from assumptions.

Past Performance — Past performance is not indicative of future results. All investing involves risk, including the possible loss of principal.

Fiduciary Standard & Conflicts — [Your Firm Name] (“Firm”) seeks to act in the best interest of clients at all times. The Firm may receive compensation as disclosed in its Form ADV and other documents. Clients should review the Firm’s disclosures for details on services, fees, and potential conflicts of interest.

Registration & Jurisdiction — Advisory services are offered only to residents of jurisdictions where the Firm is appropriately registered, exempt, or excluded from registration. This material is not an offer to provide advisory services in any jurisdiction where such offer would be unlawful.

Third‑Party Data & Assumptions — Certain data, benchmarks, or estimates may be obtained from third‑party sources believed to be reliable but are not guaranteed for accuracy or completeness. The Firm is not responsible for errors or omissions from such sources.

Tax & Legal — The Firm does not provide tax or legal advice. Clients should consult their tax advisor or attorney regarding their specific situation. Any tax estimates are for planning purposes only and may not reflect current or future law.

Suitability & Client Responsibility — Recommendations depend on the completeness and accuracy of information you provide. Please promptly notify the Firm of any material changes to your financial situation, goals, or constraints.

Rebalancing, Trading, and Fees — Portfolio rebalancing and trading may have tax consequences and incur costs. Advisory fees reduce returns over time. Refer to your advisory agreement and the Firm’s Form ADV 2A for fee schedules and disclosures.

Cybersecurity & Electronic Communications — While the Firm employs commercially reasonable safeguards, electronic communications may be subject to interception or loss. Do not transmit sensitive personal information unless instructed to do so via a secure channel.

Privacy — The Firm’s Privacy Policy describes how client information is collected, used, and safeguarded. A copy is available upon request.

Contact — [Your Firm Name], [Your Address], [Phone], [Email].`; 

function BrandingSettings({ onSaved }: { onSaved?: () => void }) {
  const { toast } = useToast();
  const rqClient = useQueryClient();
  const { data: branding, refetch } = useQuery({
    queryKey: ['/api/advisor/branding'],
    queryFn: async () => {
      const res = await fetch('/api/advisor/branding', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    }
  });

  const [firmName, setFirmName] = useState<string>(branding?.firmName || '');
  const [address, setAddress] = useState<string>(branding?.address || '');
  const [phone, setPhone] = useState<string>(branding?.phone || '');
  const [email, setEmail] = useState<string>(branding?.email || '');
  const [defaultDisclaimer, setDefaultDisclaimer] = useState<string>(branding?.defaultDisclaimer || DEFAULT_ADVISOR_DISCLAIMER);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    setFirmName(branding?.firmName || '');
    setAddress(branding?.address || '');
    setPhone(branding?.phone || '');
    setEmail(branding?.email || '');
    setDefaultDisclaimer(branding?.defaultDisclaimer || DEFAULT_ADVISOR_DISCLAIMER);
  }, [branding?.firmName, branding?.address, branding?.phone, branding?.email, branding?.defaultDisclaimer]);

  const onSave = async () => {
    try {
      const form = new FormData();
      form.set('firmName', firmName);
      form.set('address', address);
      form.set('phone', phone);
      form.set('email', email);
      form.set('defaultDisclaimer', defaultDisclaimer);
      if (logoFile) form.set('logo', logoFile);
      const res = await fetch('/api/advisor/branding', { method: 'PUT', body: form, credentials: 'include' });
      if (!res.ok) throw new Error('Failed to save branding');
      toast({ title: 'Branding saved', description: 'White-label settings updated.' });
      await rqClient.invalidateQueries({ queryKey: ['/api/advisor/branding'] });
      await refetch();
      onSaved?.();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  console.log("[BrandingSettings] render", {
    hasBranding: !!branding,
    firmName: branding?.firmName,
  });

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex items-center gap-4">
        {branding?.logoUrl && (
          <img src={branding.logoUrl} alt="Logo" className="h-12 w-auto rounded bg-gray-900/40 p-2" />
        )}
        <div>
          <Label className="text-gray-300">Logo</Label>
          <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="bg-gray-900 border-gray-700 text-gray-200" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label className="text-gray-300">Firm Name</Label>
          <Input value={firmName} onChange={(e) => setFirmName(e.target.value)} className="bg-gray-900 border-gray-700 text-gray-200" />
        </div>
        <div>
          <Label className="text-gray-300">Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} className="bg-gray-900 border-gray-700 text-gray-200" />
        </div>
        <div>
          <Label className="text-gray-300">Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-gray-900 border-gray-700 text-gray-200" />
        </div>
        <div className="md:col-span-2">
          <Label className="text-gray-300">Address</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} className="bg-gray-900 border-gray-700 text-gray-200" />
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <Label className="text-gray-300">Default Disclaimer</Label>
        <textarea
          value={defaultDisclaimer}
          onChange={(e) => setDefaultDisclaimer(e.target.value)}
          className="mt-2 flex-1 resize-none rounded border border-gray-700 bg-gray-900 p-2 text-gray-200"
          style={{ minHeight: "45vh" }}
        />
      </div>
      <div className="mt-2 flex justify-end">
        <Button onClick={onSave}>Save Branding</Button>
      </div>
    </div>
  );
}

type SortKey = 'name' | 'email' | 'status' | 'updated';

export default function AdvisorPortal() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [brandingOpen, setBrandingOpen] = useState(false);
  const brandingAllowCloseRef = useRef(false);
  const handleBrandingOpenChange = (open: boolean) => {
    console.log("[BrandingDrawer] onOpenChange", {
      requestedOpen: open,
      allowCloseFlag: brandingAllowCloseRef.current,
    });
    if (!open && !brandingAllowCloseRef.current) {
      setBrandingOpen(true);
      return;
    }
    brandingAllowCloseRef.current = false;
    setBrandingOpen(open);
    console.log("[BrandingDrawer] setBrandingOpen", open);
  };

  useEffect(() => {
    console.log("[BrandingDrawer] brandingOpen state", brandingOpen);
    if (brandingOpen) {
      requestAnimationFrame(() => {
        const drawerEl = document.querySelector('[data-test-id="branding-sheet-content"]');
        if (drawerEl instanceof HTMLElement) {
          const rect = drawerEl.getBoundingClientRect();
          console.log("[BrandingDrawer] drawer rect", rect);
          console.log("[BrandingDrawer] drawer inline transform", drawerEl.style.transform);
          console.log("[BrandingDrawer] drawer data-state", drawerEl.getAttribute('data-state'));
        } else {
          console.log("[BrandingDrawer] drawer element not found");
        }
      });
    }
  }, [brandingOpen]);
  const { data: clients, isLoading, refetch: refetchClients, error: clientsError } = useQuery({
    queryKey: ["/api/advisor/clients"],
    queryFn: async () => {
      try {
        const res = await fetch('/api/advisor/clients', { credentials: 'include' });
        if (!res.ok) return [];
        return await res.json();
      } catch {
        return [];
      }
    },
    refetchOnWindowFocus: true,
  });
  const { data: invites, refetch: refetchInvites, error: invitesError } = useQuery({
    queryKey: ["/api/advisor/invites"],
    queryFn: async () => {
      try {
        const res = await fetch('/api/advisor/invites', { credentials: 'include' });
        if (!res.ok) return [];
        return await res.json();
      } catch {
        return [];
      }
    },
    refetchOnWindowFocus: true,
  });

  const [email, setEmail] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');

  const inviteMutation = useMutation({
    mutationFn: async (e: string) => {
      await apiRequest("POST", "/api/advisor/invite", { email: e });
    },
    onSuccess: () => toast({ title: 'Invite sent', description: `Invitation sent to ${email}` }),
    onError: (err: any) => toast({ title: 'Invite failed', description: String(err?.message || err), variant: 'destructive' })
  });

  const linkMutation = useMutation({
    mutationFn: async (e: string) => {
      await apiRequest("POST", "/api/advisor/link-client", { email: e });
    },
    onSuccess: () => {
      toast({ title: 'Linked', description: `${email} linked as client` });
      qc.invalidateQueries({ queryKey: ["/api/advisor/clients"] });
    },
    onError: (err: any) => toast({ title: 'Link failed', description: String(err?.message || err), variant: 'destructive' })
  });

  const openMutation = useMutation({
    mutationFn: async (clientId: number) => {
      await apiRequest("POST", `/api/advisor/open-client/${clientId}`);
    },
    onSuccess: () => {
      window.location.href = "/";
    }
  });

  const unlinkMutation = useMutation({
    mutationFn: async (clientId: number) => {
      await apiRequest("DELETE", `/api/advisor/clients/${clientId}`);
    },
    onSuccess: () => {
      toast({ title: 'Unlinked', description: 'Client was unlinked' });
      qc.invalidateQueries({ queryKey: ["/api/advisor/clients"] });
    },
    onError: (err: any) => toast({ title: 'Unlink failed', description: String(err?.message || err), variant: 'destructive' })
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (inviteId: number) => {
      await apiRequest("POST", `/api/advisor/invites/${inviteId}/resend`);
    },
    onSuccess: () => {
      toast({ title: 'Invite resent', description: 'Invitation email has been resent' });
    },
    onError: (err: any) => toast({ title: 'Resend failed', description: String(err?.message || err), variant: 'destructive' })
  });

  const cancelInviteMutation = useMutation({
    mutationFn: async (inviteId: number) => {
      await apiRequest("DELETE", `/api/advisor/invites/${inviteId}`);
    },
    onSuccess: () => {
      toast({ title: 'Invite cancelled', description: 'The invitation has been cancelled' });
      qc.invalidateQueries({ queryKey: ["/api/advisor/invites"] });
    },
    onError: (err: any) => toast({ title: 'Cancel failed', description: String(err?.message || err), variant: 'destructive' })
  });

  // Confirm dialogs state
  const [unlinkTarget, setUnlinkTarget] = useState<{ id: number; email: string; fullName?: string } | null>(null);
  const [cancelInviteTarget, setCancelInviteTarget] = useState<{ id: number; email: string } | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<any | null>(null);

  const filteredSorted = useMemo(() => {
    const clientRows = (Array.isArray(clients) ? clients : []).map((c: any) => ({
      type: 'client' as const,
      id: c.id,
      email: c.email,
      fullName: c.fullName,
      status: c.status || 'active',
      updatedAt: c.lastUpdated || null,
    }));
    const inviteRows = (Array.isArray(invites) ? invites : []).map((i: any) => ({
      type: 'invite' as const,
      id: i.id,
      email: i.email,
      fullName: null,
      status: 'invited',
      updatedAt: i.expiresAt || i.createdAt || null,
      inviteCreatedAt: i.createdAt || null,
      inviteExpiresAt: i.expiresAt || null,
    }));
    const list = [...clientRows, ...inviteRows];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter((c: any) => (
          (c.fullName || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.status || '').toLowerCase().includes(q)
        ))
      : list;
    const sortFn = (a: any, b: any) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'name': {
          const av = (a.fullName || a.email || '').toLowerCase();
          const bv = (b.fullName || b.email || '').toLowerCase();
          return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
        }
        case 'email': {
          const av = (a.email || '').toLowerCase();
          const bv = (b.email || '').toLowerCase();
          return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
        }
        case 'status': {
          const av = (a.status || '').toLowerCase();
          const bv = (b.status || '').toLowerCase();
          return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
        }
        case 'updated':
        default: {
          const av = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bv = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
        }
      }
    };
    return [...filtered].sort(sortFn);
  }, [clients, invites, query, sortKey, sortDir]);

  const stats = useMemo(() => {
    const list = Array.isArray(clients) ? clients : [];
    const inv = Array.isArray(invites) ? invites : [];
    const total = list.length;
    const active = list.filter((c: any) => (c.status || '').toLowerCase() === 'active').length;
    const invited = inv.length;
    return { total, active, invited };
  }, [clients, invites]);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const maxPage = Math.max(1, Math.ceil((filteredSorted?.length || 0) / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, page, pageSize]);

  // Adaptive auto-refresh: faster while there are invites or unnamed clients
  const hasUnnamed = useMemo(() => {
    const list = Array.isArray(clients) ? clients : [];
    return list.some((c: any) => !c.fullName || String(c.fullName).trim() === "");
  }, [clients]);
  const hasInvites = Array.isArray(invites) && invites.length > 0;

  useEffect(() => {
    const intervalMs = (hasUnnamed || hasInvites) ? 3000 : 15000;
    const id = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/advisor/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/advisor/invites"] });
    }, intervalMs);
    return () => clearInterval(id);
  }, [hasUnnamed, hasInvites]);

  const headerButton = (label: string, key: SortKey) => (
    <button
      className={`flex items-center gap-1 text-sm text-gray-300 hover:text-white ${sortKey===key ? 'font-semibold' : ''}`}
      onClick={() => {
        if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir(key==='updated' ? 'desc' : 'asc'); }
      }}
      type="button"
    >
      {label}
      <ArrowUpDown className="h-3.5 w-3.5 opacity-70" />
    </button>
  );

  return (
    <div className="min-h-screen">
      {/* Branded Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-bg opacity-90" />
        <div className="relative z-10 container mx-auto px-6 py-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-white" />
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide text-white">AFFLUVIA</h1>
              <span className="text-white/70">• Advisor Portal</span>
            </div>
            <Button
              onClick={() => setBrandingOpen(true)}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
              size="sm"
            >
              <Paintbrush className="h-4 w-4 mr-2" /> White-label Branding
            </Button>
          </div>
          <p className="text-white/80 mt-2">Welcome{user?.fullName ? `, ${user.fullName}` : ''}. Manage clients, send invites, and open client portals.</p>
        </div>
      </div>

      {/* (Accordion removed per request; branding is edited via the drawer button) */}

      <Sheet open={brandingOpen} onOpenChange={handleBrandingOpenChange}>
        <SheetContent
          side="bottom"
          hideClose
          className="flex h-[90vh] flex-col bg-gray-900 text-white border-t border-gray-800"
          data-test-id="branding-sheet-content"
        >
          <SheetHeader className="relative pb-2">
            <SheetTitle className="text-white">White-Label Branding</SheetTitle>
            <SheetDescription className="text-gray-400">
              Upload your logo and firm details to customize report headers.
            </SheetDescription>
            <SheetClose
              className="absolute right-4 top-4 rounded-md bg-transparent text-white/80 hover:text-white focus:outline-none"
              onClick={() => {
                brandingAllowCloseRef.current = true;
              }}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </SheetClose>
          </SheetHeader>
          <div className="flex flex-1 flex-col overflow-y-auto pt-2 text-white">
            <BrandingSettings
              onSaved={() => {
                brandingAllowCloseRef.current = true;
                setBrandingOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="card-gradient border-gray-700 hover-lift">
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-6 w-6 text-purple-300" />
              <div>
                <div className="text-sm text-gray-400">Total Clients</div>
                <div className="text-xl font-semibold text-white">{stats.total}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-gradient border-gray-700 hover-lift">
            <CardContent className="p-4 flex items-center gap-3">
              <Mail className="h-6 w-6 text-green-300" />
              <div>
                <div className="text-sm text-gray-400">Active</div>
                <div className="text-xl font-semibold text-white">{stats.active}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-gradient border-gray-700 hover-lift">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-6 w-6 text-yellow-300" />
              <div>
                <div className="text-sm text-gray-400">Invited</div>
                <div className="text-xl font-semibold text-white">{stats.invited}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      <Card className="card-gradient border-gray-700 hover-lift">
        <CardHeader>
          <CardTitle className="text-white">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="client@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-gray-800 border-gray-700 text-white max-w-sm" />
            <Button disabled={!email || inviteMutation.isPending} onClick={() => inviteMutation.mutate(email)}>
              {inviteMutation.isPending ? 'Sending…' : 'Invite'}
            </Button>
            <Button
              variant="outline"
              className="text-white bg-gray-900/40 border border-[#8A00C4] hover:bg-[#8A00C4] hover:text-white"
              disabled={!email || linkMutation.isPending}
              onClick={() => linkMutation.mutate(email)}
            >
              {linkMutation.isPending ? 'Linking…' : 'Link Existing'}
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-2 max-w-md">
            <Search className="h-4 w-4 text-gray-400" />
            <Input placeholder="Search by name, email, status" value={query} onChange={(e) => setQuery(e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
          </div>
        </CardContent>
      </Card>

      <Card className="card-gradient border-gray-700 hover-lift">
        <CardHeader>
          <CardTitle className="text-white">Clients</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-gray-300">Loading...</div>
          ) : !filteredSorted || filteredSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="h-16 w-16 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-purple-300" />
              </div>
              <div className="text-white text-lg font-semibold">No clients yet</div>
              <div className="text-gray-400 max-w-md mt-1">Invite a client by email or link an existing account. You can then open their full portal and manage their plan.</div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <div className="grid grid-cols-12 text-sm text-gray-300 px-3 py-2 border-b border-gray-700 sticky top-0 bg-gray-900/80 backdrop-blur">
                <div className="col-span-3">{headerButton('Name', 'name')}</div>
                <div className="col-span-4">{headerButton('Email', 'email')}</div>
                <div className="col-span-2">{headerButton('Status', 'status')}</div>
                <div className="col-span-2">{headerButton('Last Updated', 'updated')}</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>
              <div className="divide-y divide-gray-800">
                {paged.map((c: any) => (
                  <div key={c.id} className="grid grid-cols-12 items-center px-3 py-3">
                    <div className="col-span-3 flex items-center gap-3 text-gray-200">
                      <div className="h-8 w-8 rounded-full bg-purple-600/30 border border-purple-500/30 flex items-center justify-center text-sm text-purple-200">
                        {(c.fullName || c.email || '?').slice(0,1).toUpperCase()}
                      </div>
                      <span>{c.fullName || '—'}</span>
                    </div>
                    <div className="col-span-4 text-gray-300">{c.email}</div>
                    <div className="col-span-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${c.status==='active' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>{c.status}</span>
                    </div>
                    <div className="col-span-2 text-gray-400">{c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '—'}</div>
                    <div className="col-span-1 flex items-center justify-end gap-1">
                      {c.type === 'client' ? (
                        <TooltipProvider>
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" className="text-gray-200" onClick={() => openMutation.mutate(c.id)} aria-label="Open client portal">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Open Client Portal</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" className="text-gray-200" onClick={() => setDetailsTarget(c)} aria-label="View details">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View details</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" onClick={() => setUnlinkTarget({ id: c.id, email: c.email, fullName: c.fullName })} aria-label="Remove client">
                                  <Trash className="h-4 w-4 text-red-300" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Remove client</TooltipContent>
                            </Tooltip>
                          </>
                        </TooltipProvider>
                      ) : (
                        <TooltipProvider>
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" className="text-gray-200" onClick={() => resendInviteMutation.mutate(c.id)} disabled={resendInviteMutation.isPending} aria-label="Resend invite">
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Resend Invite</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" className="text-gray-200" onClick={() => setDetailsTarget(c)} aria-label="View invite details">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View details</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" className="text-red-300 hover:text-red-200" onClick={() => setCancelInviteTarget({ id: c.id, email: c.email })} aria-label="Cancel invite">
                                  <X className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Cancel Invite</TooltipContent>
                            </Tooltip>
                          </>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* Pagination Controls */}
              <div className="flex items-center justify-between mt-4 text-sm text-gray-300">
                <div>
                  Showing {(paged.length ? (page - 1) * pageSize + 1 : 0)}–{(page - 1) * pageSize + paged.length} of {filteredSorted.length}
                </div>
                <div className="flex items-center gap-2">
                  <select className="bg-gray-800 border border-gray-700 rounded px-2 py-1" value={pageSize} onChange={(e) => { setPage(1); setPageSize(parseInt(e.target.value)); }}>
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                  </select>
                  <Button size="sm" variant="secondary" disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))}>Prev</Button>
                  <div className="min-w-[3rem] text-center">{page} / {maxPage}</div>
                  <Button size="sm" variant="secondary" disabled={page>=maxPage} onClick={() => setPage(p => Math.min(maxPage, p+1))}>Next</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Confirm Unlink Dialog */}
      <AlertDialog open={!!unlinkTarget} onOpenChange={(o) => { if (!o) setUnlinkTarget(null); }}>
        <AlertDialogContent className="bg-gray-900 border border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remove client?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will remove your access to {unlinkTarget?.fullName || unlinkTarget?.email}. You can re-link them later by email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-900/40 text-white border border-gray-700 hover:bg-white/10" onClick={() => setUnlinkTarget(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction className="text-white bg-gray-900/40 border border-[#8A00C4] hover:bg-[#8A00C4] hover:text-white" onClick={() => { if (unlinkTarget) unlinkMutation.mutate(unlinkTarget.id); setUnlinkTarget(null); }}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Cancel Invite Dialog */}
      <AlertDialog open={!!cancelInviteTarget} onOpenChange={(o) => { if (!o) setCancelInviteTarget(null); }}>
        <AlertDialogContent className="bg-gray-900 border border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Cancel this invitation?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              The invite sent to {cancelInviteTarget?.email} will be invalidated. You can send a new invite anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-900/40 text-white border border-gray-700 hover:bg-white/10" onClick={() => setCancelInviteTarget(null)}>
              Keep
            </AlertDialogCancel>
            <AlertDialogAction className="text-white bg-gray-900/40 border border-[#8A00C4] hover:bg-[#8A00C4] hover:text-white" onClick={() => { if (cancelInviteTarget) cancelInviteMutation.mutate(cancelInviteTarget.id); setCancelInviteTarget(null); }}>
              Cancel Invite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Details Drawer */}
      <Drawer open={!!detailsTarget} onOpenChange={(o) => { if (!o) setDetailsTarget(null); }}>
        <DrawerContent className="bg-gray-900 border-gray-800">
          <DrawerHeader>
            <DrawerTitle className="text-white">{detailsTarget?.fullName || detailsTarget?.email || 'Details'}</DrawerTitle>
            <DrawerDescription className="text-gray-400">{detailsTarget?.type === 'client' ? 'Client snapshot' : 'Invitation details'}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-2">
            {detailsTarget && (
              detailsTarget.type === 'client' ? (
                <ClientDetails 
                  clientId={detailsTarget.id} 
                  email={detailsTarget.email} 
                  onOpen={() => openMutation.mutate(detailsTarget.id)} 
                  onUnlink={() => setUnlinkTarget({ id: detailsTarget.id, email: detailsTarget.email, fullName: detailsTarget.fullName })} 
                />
              ) : (
                <InviteDetails 
                  invite={detailsTarget} 
                  invites={invites} 
                  onResend={() => resendInviteMutation.mutate(detailsTarget.id)} 
                  onCancel={() => setCancelInviteTarget({ id: detailsTarget.id, email: detailsTarget.email })} 
                />
              )
            )}
          </div>
          <DrawerFooter>
            <Button 
              className="gradient-bg text-white hover:opacity-90 shadow-md shadow-purple-500/20"
              onClick={() => setDetailsTarget(null)}
            >
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
    </div>
  );
}

function useClientSummary(clientId: number | null) {
  return useQuery({
    queryKey: ["/api/advisor/client-summary", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/advisor/client-summary/${clientId}`);
      return res.json();
    }
  });
}

function ClientDetails({ clientId, email, onOpen, onUnlink }: { clientId: number; email: string; onOpen: () => void; onUnlink: () => void }) {
  const { data, isLoading } = useClientSummary(clientId);
  if (isLoading) return <div className="text-gray-300">Loading details…</div>;
  if (!data) return <div className="text-gray-400">No details available.</div>;
  const profile = data.profile;
  const counts = data.counts || { chats: 0, goals: 0, documents: 0 };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gray-800/60 border-gray-700">
          <CardContent className="p-3">
            <div className="text-xs text-gray-400">Last Updated</div>
            <div className="text-white">{profile?.lastUpdated ? new Date(profile.lastUpdated).toLocaleString() : '—'}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/60 border-gray-700">
          <CardContent className="p-3">
            <div className="text-xs text-gray-400">Last Activity</div>
            <div className="text-white">{data.lastActivity ? new Date(data.lastActivity).toLocaleString() : '—'}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/60 border-gray-700">
          <CardContent className="p-3">
            <div className="text-xs text-gray-400">Status</div>
            <div className="text-white">{profile?.isComplete ? 'Complete' : 'In progress'}</div>
          </CardContent>
        </Card>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <Card className="bg-gray-800/60 border-gray-700"><CardContent className="p-3"><div className="text-xs text-gray-400">Goals</div><div className="text-white text-lg font-semibold">{counts.goals}</div></CardContent></Card>
        <Card className="bg-gray-800/60 border-gray-700"><CardContent className="p-3"><div className="text-xs text-gray-400">Estate Docs</div><div className="text-white text-lg font-semibold">{counts.documents}</div></CardContent></Card>
        <Card className="bg-gray-800/60 border-gray-700"><CardContent className="p-3"><div className="text-xs text-gray-400">Chats</div><div className="text-white text-lg font-semibold">{counts.chats}</div></CardContent></Card>
      </div>
      <div className="flex gap-2">
        <Button onClick={onOpen}>Open Client Portal</Button>
        <Button
          variant="outline"
          className="text-white bg-gray-900/40 border border-[#8A00C4] hover:bg-[#8A00C4] hover:text-white"
          onClick={onUnlink}
        >
          Unlink
        </Button>
      </div>
      <div className="text-xs text-gray-500">Email: {email}</div>
    </div>
  );
}

function InviteDetails({ invite, invites, onResend, onCancel }: { invite: any; invites: any[]; onResend: () => void; onCancel: () => void }) {
  const full = (Array.isArray(invites) ? invites : []).find((i: any) => i.id === invite.id);
  const createdAt = full?.createdAt || invite.inviteCreatedAt;
  const expiresAt = full?.expiresAt || invite.inviteExpiresAt;
  const ttl = expiresAt ? Math.max(0, new Date(expiresAt).getTime() - Date.now()) : null;
  const days = ttl ? Math.floor(ttl / (1000*60*60*24)) : null;
  const hours = ttl ? Math.floor((ttl % (1000*60*60*24)) / (1000*60*60)) : null;
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <Card className="bg-gray-800/60 border-gray-700"><CardContent className="p-3"><div className="text-xs text-gray-400">Invited</div><div className="text-white">{createdAt ? new Date(createdAt).toLocaleString() : '—'}</div></CardContent></Card>
        <Card className="bg-gray-800/60 border-gray-700"><CardContent className="p-3"><div className="text-xs text-gray-400">Expires</div><div className="text-white">{expiresAt ? new Date(expiresAt).toLocaleString() : '—'}</div></CardContent></Card>
        <Card className="bg-gray-800/60 border-gray-700"><CardContent className="p-3"><div className="text-xs text-gray-400">Time Remaining</div><div className="text-white">{ttl !== null ? `${days}d ${hours}h` : '—'}</div></CardContent></Card>
      </div>
      <div className="flex gap-2">
        <Button onClick={onResend}>Resend Invite</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel Invite</Button>
      </div>
      <div className="text-xs text-gray-500">Email: {invite.email}</div>
    </div>
  );
}
