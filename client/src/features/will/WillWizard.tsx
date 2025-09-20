import React, { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RefreshCw } from "lucide-react";
import type { WillForm as WillFormType, ResiduaryPlan, BeneficiarySlice } from "@shared/will-types";
import { WillForm as WillSchema } from "@shared/will-types";

type Slice = BeneficiarySlice;

const KINDS = [
  { value: "person", label: "Person" },
  { value: "charity", label: "Charity" },
];

function percentTotal(slices: Slice[]) {
  return Math.round((slices || []).reduce((s, x) => s + (Number(x.percent) || 0), 0));
}

async function getCurrentWill(): Promise<WillFormType> {
  const r = await fetch("/api/wills/current", { credentials: "include" });
  if (!r.ok) throw new Error("Failed to load will");
  return r.json();
}
async function saveWill(data: WillFormType) {
  const r = await fetch("/api/wills", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to save will");
  return r.json();
}
async function generateWill(data?: WillFormType) {
  const r = await fetch("/api/wills/generate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : "{}",
  });
  if (!r.ok) throw new Error("Failed to generate");
  return r.json();
}

export function WillWizard() {
  const [step, setStep] = useState(1);
  const maxStep = 8;
  const [generated, setGenerated] = useState(false);
  const queryClient = useQueryClient();

  const { data: initial, isLoading } = useQuery({
    queryKey: ["will-current"],
    queryFn: getCurrentWill,
  });

  const form = useForm<WillFormType>({
    resolver: zodResolver(WillSchema),
    defaultValues: initial,
    mode: "onChange",
  });

  useEffect(() => {
    if (initial) form.reset(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const saveMut = useMutation({ mutationFn: saveWill });
  const genMut = useMutation({ mutationFn: generateWill });

  const goNext = async () => {
    const ok = await form.trigger();
    if (!ok) return;
    await saveMut.mutateAsync(form.getValues());
    setStep((s) => Math.min(maxStep, s + 1));
  };
  const goPrev = () => setStep((s) => Math.max(1, s - 1));

  if (isLoading || !initial) {
    return (
      <Card className="bg-gray-800/60 border-gray-700">
        <CardHeader><CardTitle className="text-white">Will Creator</CardTitle></CardHeader>
        <CardContent className="text-gray-300">Loading…</CardContent>
      </Card>
    );
  }

  const values = form.watch();

  return (
    <Card className="bg-gray-800/60 border-gray-700">
      <CardHeader className="space-y-1">
        <CardTitle className="text-white">Will Creator</CardTitle>
        <div className="text-xs text-gray-400">Step {step} of {maxStep}</div>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 1 && <Basics form={form} />}
        {step === 2 && <Nominees form={form} />}
        {step === 3 && <Assets form={form} />}
        {step === 4 && <Residuary form={form} />}
        {step === 5 && <Gifts form={form} />}
        {step === 6 && <Funeral form={form} />}
        {step === 7 && <Provisions form={form} />}
        {step === 8 && <Review values={values} />}

        <div className="flex items-center justify-between">
          {step > 1 ? (
            <Button
              variant="outline"
              className="bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50"
              onClick={goPrev}
            >
              Previous
            </Button>
          ) : (
            <div></div>
          )}
          <div className="flex items-center gap-2">
            {step < maxStep && (
              <Button className="bg-purple-600 hover:bg-purple-500" onClick={goNext} disabled={saveMut.isPending}>
                {saveMut.isPending ? "Saving…" : "Save & Continue"}
              </Button>
            )}
            {step === maxStep && (
              <>
                <Button
                  className={generated ? "bg-gray-700 text-gray-300 cursor-default" : "bg-purple-600 hover:bg-purple-500"}
                  onClick={async () => {
                    if (generated) return;
                    await saveMut.mutateAsync(form.getValues());
                    // Request ZIP bundle of individual PDFs and trigger browser download
                    const resp = await fetch('/api/wills/generate?format=zip&bundle=zip', {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(form.getValues()),
                    });
                    if (!resp.ok) throw new Error('Failed to generate PDF');
                    const blob = await resp.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'Will Packet.zip';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                    setGenerated(true);
                  }}
                  disabled={genMut.isPending}
                >
                  {generated ? 'Generated Will Packet' : (genMut.isPending ? 'Generating…' : 'Generate Will Packet')}
                </Button>
                {generated && (
                  <Button
                    variant="outline"
                    className="bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50"
                    onClick={async () => {
                      try {
                        await fetch('/api/wills/current', { method: 'DELETE', credentials: 'include' });
                      } catch {}
                      const blank: WillFormType = {
                        person: { first: "", last: "" } as any,
                        maritalStatus: "single",
                        spouse: undefined,
                        children: [],
                        executors: [{ name: "", relationship: "" } as any],
                        digitalExecutor: { useSame: true, accessComms: true },
                        assets: { list: [] },
                        residuary: { primary: { slices: [] }, takersOfLastResort: "heirs" } as any,
                        gifts: [],
                        provisions: { independentAdmin: true, noContest: true, selfProving: true, nonprofitConsent: false, includeSpecialNeedsTrust: true },
                        funeral: { agents: [""] },
                        messages: [],
                      } as any;
                      form.reset(blank);
                      queryClient.setQueryData(["will-current"], blank);
                      setStep(1);
                      setGenerated(false);
                    }}
                  >
                    Create New Will
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Steps ---------- */

function Basics({ form }: { form: ReturnType<typeof useForm<WillFormType>> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label className="text-white">First name</Label>
        <Input className="bg-gray-900/60 border-gray-700 text-white" {...form.register("person.first")} />
      </div>
      <div className="space-y-2">
        <Label className="text-white">Middle name</Label>
        <Input className="bg-gray-900/60 border-gray-700 text-white" {...form.register("person.middle")} />
      </div>
      <div className="space-y-2">
        <Label className="text-white">Last name</Label>
        <Input className="bg-gray-900/60 border-gray-700 text-white" {...form.register("person.last")} />
      </div>
      <div className="space-y-2">
        <Label className="text-white">City</Label>
        <Input className="bg-gray-900/60 border-gray-700 text-white" {...form.register("person.city")} />
      </div>
      <div className="space-y-2">
        <Label className="text-white">State</Label>
        <Input className="bg-gray-900/60 border-gray-700 text-white" {...form.register("person.state")} />
      </div>
      <div className="space-y-2">
        <Label className="text-white">Marital status</Label>
        <Controller
          control={form.control}
          name="maritalStatus"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="bg-gray-900/60 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="single" className="text-white">Single</SelectItem>
                <SelectItem value="married" className="text-white">Married</SelectItem>
                <SelectItem value="domesticPartnership" className="text-white">Domestic Partnership</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {form.watch("maritalStatus") === "married" && (
        <div className="space-y-2 md:col-span-2">
          <Label className="text-white">Spouse name</Label>
          <Input className="bg-gray-900/60 border-gray-700 text-white" {...form.register("spouse.name")} />
        </div>
      )}

      <ChildrenList form={form} />
    </div>
  );
}

function ChildrenList({ form }: { form: ReturnType<typeof useForm<WillFormType>> }) {
  const fa = useFieldArray({ control: form.control, name: "children" });
  return (
    <div className="md:col-span-2 space-y-2">
      <Label className="text-white">Children</Label>
      <div className="space-y-2">
        {fa.fields.map((f, i) => (
          <div key={f.id} className="grid gap-2 md:grid-cols-3">
            <Input className="bg-gray-900/60 border-gray-700 text-white md:col-span-2" placeholder="Full legal name" {...form.register(`children.${i}.name` as const)} />
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Switch checked={!!form.watch(`children.${i}.isMinor` as const)} onCheckedChange={(v) => form.setValue(`children.${i}.isMinor` as const, v)} />
              <span>Minor (under 18)</span>
            </div>
          </div>
        ))}
        <Button
          variant="outline"
          className="bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50"
          onClick={() => fa.append({ name: "", isMinor: false })}
        >
          Add child
        </Button>
      </div>
    </div>
  );
}

function Nominees({ form }: { form: ReturnType<typeof useForm<WillFormType>> }) {
  const fa = useFieldArray({ control: form.control, name: "executors" });
  const useSame = form.watch("digitalExecutor.useSame");
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-white">Executors (in order)</Label>
        <div className="space-y-2">
          {fa.fields.map((f, i) => (
            <div key={f.id} className="grid gap-2 md:grid-cols-3">
              <Input className="bg-gray-900/60 border-gray-700 text-white md:col-span-2" placeholder="Full name" {...form.register(`executors.${i}.name` as const)} />
              <Input className="bg-gray-900/60 border-gray-700 text-white" placeholder="Relationship" {...form.register(`executors.${i}.relationship` as const)} />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50"
            onClick={() => fa.append({ name: "", relationship: "" })}
          >
            Add executor
          </Button>
          {fa.fields.length > 1 && (
            <Button
              variant="outline"
              className="bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50"
              onClick={() => fa.remove(fa.fields.length - 1)}
            >
              Remove last
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-white">Digital Executor</Label>
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Switch checked={useSame} onCheckedChange={(v) => form.setValue("digitalExecutor.useSame", v)} />
          <span>Use estate executor as digital executor</span>
        </div>
        {!useSame && (
          <div className="grid gap-2 md:grid-cols-3">
            <Input className="bg-gray-900/60 border-gray-700 text-white md:col-span-2" placeholder="Full name" {...form.register("digitalExecutor.nominee.name")} />
            <Input className="bg-gray-900/60 border-gray-700 text-white" placeholder="Relationship" {...form.register("digitalExecutor.nominee.relationship")} />
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Switch checked={!!form.watch("digitalExecutor.accessComms")} onCheckedChange={(v) => form.setValue("digitalExecutor.accessComms", v)} />
          <span>Allow access to electronic communications</span>
        </div>
      </div>
    </div>
  );
}

function Assets({ form }: { form: ReturnType<typeof useForm<WillFormType>> }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetValue, setNewAssetValue] = useState("");
  const currentList = (form.watch("assets.list" as any) as Array<any>) || [];
  const mode = form.watch("assets?.mode" as any) as "list" | "estimate" | undefined;

  // Pull the user profile to surface assets (manual + Plaid) and home equity
  const testatorFirst = String(form.watch("person.first") || "").trim();
  const { data: profile } = useQuery({
    queryKey: ["/api/financial-profile"],
    queryFn: async () => {
      const response = await fetch("/api/financial-profile", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch profile");
      return response.json();
    },
  });
  const { data: ownerAudit } = useQuery({
    queryKey: ["/api/ownership-beneficiary-audit", testatorFirst || "", profile?.firstName || ""],
    queryFn: async () => {
      const url = new URL("/api/ownership-beneficiary-audit", window.location.origin);
      const fallbackFirst = String(profile?.firstName || "").trim().split(/\s+/)[0];
      const name = (testatorFirst || fallbackFirst || "").trim();
      if (name) url.searchParams.set("testatorFirst", name);
      const res = await fetch(url.toString(), { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch ownership audit');
      return res.json();
    },
    // Always enabled; server supports both filtered and unfiltered responses
    enabled: true,
  });

  // Build audit-style assets. Prefer server response; fallback to computing from profile
  const auditAssets = useMemo(() => {
    if (Array.isArray(ownerAudit?.assets) && ownerAudit.assets.length > 0) {
      return ownerAudit.assets;
    }
    if (!profile) return [] as any[];

    const toLower = (s: any) => String(s || '').trim().toLowerCase();
    const pfFirst = toLower(profile.firstName?.split(/\s+/)[0]);
    const spouseFirst = toLower((profile.spouseName || '').split(/\s+/)[0]);
    const testatorFirstLocal = toLower(testatorFirst);
    const testatorRole = testatorFirstLocal
      ? (testatorFirstLocal === spouseFirst ? 'spouse' : 'user')
      : 'user';

    const mapOwner = (owner: any) => {
      const o = toLower(owner);
      if (o === 'joint') return { ownership: 'joint' as const, accountOwner: 'user' as const };
      if (o === 'spouse') return { ownership: 'individual' as const, accountOwner: 'spouse' as const };
      return { ownership: 'individual' as const, accountOwner: 'user' as const };
    };

    const mapType = (t: any) => {
      const x = toLower(t);
      if (x === 'checking' || x === 'savings') return 'bank';
      if (x === 'taxable-brokerage') return 'investment';
      if (['401k','403b','traditional-ira','roth-ira','hsa','qualified-annuities'].includes(x)) return 'retirement';
      if (x === 'cash-value-life-insurance') return 'life_insurance';
      if (x === 'real_estate') return 'real_estate';
      return x || 'manual';
    };

    const fromAssets = (profile.assets || []).map((a: any) => {
      const owner = mapOwner(a.owner);
      return {
        type: mapType(a.type),
        name: a.description || a.type || 'Asset',
        value: Number(a.value) || 0,
        ownership: owner.ownership,
        accountOwner: owner.accountOwner,
      };
    });

    const fromResidence = profile.primaryResidence ? [{
      type: 'real_estate',
      name: 'Primary Residence',
      value: Number(profile.primaryResidence.marketValue || 0) - Number(profile.primaryResidence.mortgageBalance || 0),
      ownership: toLower(profile.primaryResidence.owner) === 'joint' ? 'joint' : 'individual',
      accountOwner: toLower(profile.primaryResidence.owner) === 'spouse' ? 'spouse' : 'user',
    }] : [];

    const fromLife = profile.lifeInsurance?.hasPolicy ? [{
      type: 'life_insurance',
      name: `Life Insurance - ${profile.lifeInsurance.policyType || 'Policy'}`,
      value: Number(profile.lifeInsurance.coverageAmount) || 0,
      ownership: 'individual',
      accountOwner: toLower(profile.lifeInsurance.policyOwner) === 'spouse' ? 'spouse' : 'user',
      requiresBeneficiary: true,
      hasBeneficiary: Boolean(toLower(profile.lifeInsurance?.beneficiaries?.primary || '')),
      hasContingentBeneficiary: Boolean(toLower(profile.lifeInsurance?.beneficiaries?.contingent || '')),
    }] : [];

    // Filter to testator's assets + joint
    const combined = [...fromAssets, ...fromResidence, ...fromLife];
    const filtered = combined.filter((a: any) => {
      const ownership = toLower(a.ownership);
      if (ownership === 'joint') return true;
      const ownerRole = toLower(a.accountOwner);
      if (ownerRole === 'user' || ownerRole === 'spouse') return ownerRole === testatorRole;
      return ownership === 'individual' && testatorRole === 'user';
    });
    return filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerAudit, profile, testatorFirst]);
  const isJointAsset = (item: any) => String(item?.ownership || (item?.isJoint ? "joint" : "")).toLowerCase() === "joint" || item?.isJoint === true;

  // Create a normalized, de-duplicated view of audit assets for display and adding
  const auditAssetsUnique = useMemo(() => {
    const out: any[] = [];
    const seen = new Set<string>();
    (auditAssets || []).forEach((a: any) => {
      const name = (a.name || a.accountName || a.type || "Asset").toString().trim();
      const value = Number(a.value) || 0;
      const key = `${name.toLowerCase()}|${value}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          ...a,
          name,
          value,
          type: String(a.type || '').toLowerCase() || 'manual',
          isJoint: isJointAsset(a),
        });
      }
    });
    return out;
  }, [auditAssets]);

  const totalAssets = useMemo(() => {
    return auditAssetsUnique.reduce((sum: number, asset: any) => sum + (Number(asset?.value) || 0), 0);
  }, [auditAssetsUnique]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
      Math.round(n || 0)
    );

  const addManualAsset = () => {
    const v = Number(newAssetValue);
    const clean = { name: newAssetName.trim() || "Asset", value: Number.isFinite(v) ? v : 0, type: "manual", isJoint: false };
    const next = [...currentList, clean];
    form.setValue("assets.list" as any, next);
    form.setValue("assets.mode" as any, "list");
    setNewAssetName("");
    setNewAssetValue("");
    setAddOpen(false);
  };
  const removeManualAsset = (idx: number) => {
    const next = currentList.filter((_, i) => i !== idx);
    form.setValue("assets.list" as any, next);
  };

  // Auto‑populate "Assets Selected for Will" with the testator's assets once
  const [autoAdded, setAutoAdded] = useState(false);
  useEffect(() => {
    if (autoAdded) return;
    if (!Array.isArray(auditAssetsUnique) || auditAssetsUnique.length === 0) return;

    const exists = new Set(currentList.map((x) => `${(x.name || "").toLowerCase()}|${Number(x.value) || 0}`));
    const toAdd: any[] = [];

    const addIfNew = (item: any) => {
      const key = `${(item.name || "").toLowerCase()}|${Number(item.value) || 0}`;
      if (!exists.has(key)) {
        exists.add(key);
        toAdd.push(item);
      }
    };

    // Only include the testator's assets (individual or joint). If server already filtered,
    // this keeps behavior consistent; if unfiltered, it excludes spouse-only items.
    const isTestatorAsset = (a: any) => {
      const ownership = String(a?.ownership || "").toLowerCase();
      const ownerRole = String(a?.accountOwner || a?.policyOwner || "user").toLowerCase();
      const joint = ownership === "joint";
      const individualForUser = ownership !== "joint" && ownerRole === "user";
      return joint || individualForUser;
    };

    auditAssetsUnique
      .filter(isTestatorAsset)
      .forEach((asset: any) =>
        addIfNew({
          name: asset.name || asset.type || "Asset",
          value: Number(asset.value) || 0,
          type: String(asset.type || "").toLowerCase() || "manual",
          isJoint: isJointAsset(asset),
        })
      );

    if (toAdd.length > 0) {
      form.setValue("assets.list" as any, [...currentList, ...toAdd]);
      form.setValue("assets.mode" as any, "list");
    }
    setAutoAdded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditAssetsUnique, currentList, autoAdded]);

  return (
    <div className="space-y-4">

      {totalAssets > 0 && (
        <div className="rounded-lg border border-emerald-700 bg-emerald-900/20 p-3">
          <div className="text-sm text-emerald-200">
            <strong>Assets from your profile:</strong> {fmt(totalAssets)}
          </div>
          <div className="text-xs text-emerald-300 mt-1">This includes your manual entries and Plaid-connected accounts.</div>
        </div>
      )}

      {
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-white">Your Assets</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                title="Refresh assets"
                className="p-2 h-9 w-9 flex items-center justify-center bg-emerald-800/50 border-emerald-600 text-emerald-200 hover:bg-emerald-700/50"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/financial-profile"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/ownership-beneficiary-audit"] });
                }}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50"
                onClick={() => setAddOpen((o) => !o)}
              >
                Add Asset
              </Button>
              <Button
                variant="outline"
                className="bg-emerald-800/50 border-emerald-600 text-emerald-200 hover:bg-emerald-700/50"
                onClick={() => {
                if (!profile) return;
                const exists = new Set(currentList.map((x) => `${(x.name||"").toLowerCase()}|${Number(x.value)||0}`));
                const addIfNew = (item: any) => {
                  const key = `${(item.name||"").toLowerCase()}|${Number(item.value)||0}`;
                  if (!exists.has(key)) {
                    exists.add(key);
                    tmp.push(item);
                  }
                };
                const tmp: any[] = [];
                auditAssetsUnique.forEach((asset: any) => addIfNew({
                  name: asset.name || asset.type || "Asset",
                  value: Number(asset.value) || 0,
                  type: String(asset.type || '').toLowerCase() || 'manual',
                  isJoint: isJointAsset(asset),
                }));
                form.setValue("assets.list" as any, [...currentList, ...tmp]);
                form.setValue("assets.mode" as any, "list");
                }}
              >
                Add to Will
              </Button>
            </div>
          </div>
          {addOpen && (
            <div className="grid gap-2 md:grid-cols-3 bg-gray-900/40 border border-gray-800 rounded-md p-3">
              <Input
                className="bg-gray-900/60 border-gray-700 text-white"
                placeholder="Asset name"
                value={newAssetName}
                onChange={(e) => setNewAssetName(e.target.value)}
              />
              <Input
                className="bg-gray-900/60 border-gray-700 text-white"
                placeholder="Value"
                inputMode="numeric"
                value={newAssetValue}
                onChange={(e) => setNewAssetValue(e.target.value.replace(/[^0-9.]/g, ""))}
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  className="bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50"
                  onClick={() => setAddOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-500"
                  onClick={addManualAsset}
                  disabled={!newAssetName.trim()}
                >
                  Save Asset
                </Button>
              </div>
            </div>
          )}
          <div className="text-sm text-gray-400">Assets from your profile (deduplicated):</div>
          <div className="space-y-2">
            {auditAssetsUnique.length === 0 && (
              <div className="text-sm text-gray-500">No assets available.</div>
            )}
            {auditAssetsUnique.map((asset: any, i: number) => (
              <div key={`asset-${i}`} className="text-sm text-gray-300 bg-gray-800/30 p-2 rounded">
                {(asset.name || asset.type || "Asset")} : {fmt(Number(asset.value) || 0)}
                {String(asset.ownership || '').toLowerCase() === 'joint' && <span className="text-blue-300 ml-2">(Joint)</span>}
              </div>
            ))}
          </div>

          {/* Assets Selected / Included in Will */}
          <div className="mt-6">
            <div className="text-sm font-medium text-white mb-2">Assets Selected for Will:</div>
            {currentList.length === 0 ? (
              <div className="text-sm text-gray-400">No assets selected yet. Use Add to Will or add manually.</div>
            ) : (
              currentList.map((asset: any, i: number) => (
                <div key={`selected-${i}`} className="text-sm text-gray-300 bg-gray-800/30 p-2 rounded flex items-center justify-between">
                  <span>{asset.name || "Asset"} : {fmt(Number(asset.value) || 0)}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-red-900/20 border-red-700 text-red-300 hover:bg-red-900/40"
                    onClick={() => removeManualAsset(i)}
                  >
                    Remove
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      }
    </div>
  );
}

function SlicesEditor({
  value,
  onChange,
  label,
}: {
  value: Slice[];
  onChange: (s: Slice[]) => void;
  label: string;
}) {
  const [local, setLocal] = useState<Slice[]>(value?.length ? value : [{ kind: "person", name: "", percent: 100 } as any]);
  useEffect(() => setLocal(value?.length ? value : [{ kind: "person", name: "", percent: 100 } as any]), [value]);

  const total = useMemo(() => percentTotal(local), [local]);
  const set = (i: number, patch: Partial<Slice>) => {
    const next = [...local];
    next[i] = { ...next[i], ...patch } as Slice;
    setLocal(next);
    onChange(next);
  };
  const add = () => {
    const next = [...local, { kind: "person", name: "", percent: 0 } as Slice];
    setLocal(next);
    onChange(next);
  };
  const remove = (i: number) => {
    const next = local.filter((_, idx) => idx !== i);
    setLocal(next);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <Label className="text-white">{label}</Label>
      <div className="space-y-2">
        {local.map((s, i) => (
          <div key={i} className="grid gap-2 md:grid-cols-4">
            <Select value={s.kind} onValueChange={(v) => set(i, { kind: v as any })}>
              <SelectTrigger className="bg-gray-900/60 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {KINDS.map((k) => <SelectItem key={k.value} value={k.value} className="text-white">{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="bg-gray-900/60 border-gray-700 text-white md:col-span-2" placeholder={s.kind === "charity" ? "Charity name" : "Person full name"} value={s.name} onChange={(e) => set(i, { name: e.target.value })} />
            <Input className="bg-gray-900/60 border-gray-700 text-white" placeholder="%" inputMode="numeric" value={String((s as any).percent ?? "")} onChange={(e) => set(i, { percent: Number(e.target.value.replace(/[^0-9.]/g, "")) as any })} />
            <div className="md:col-span-4">
              <Input className="bg-gray-900/60 border-gray-800 text-white" placeholder="Notes (optional)" value={(s as any).notes || ""} onChange={(e) => set(i, { notes: e.target.value } as any)} />
            </div>
            {local.length > 1 && (
              <div className="md:col-span-4">
                <Button
                  variant="outline"
                  className="bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50"
                  onClick={() => remove(i)}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          className="bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50"
          onClick={add}
        >
          Add beneficiary
        </Button>
        <div className={`text-sm ${total === 100 ? "text-emerald-300" : "text-amber-300"}`}>Total: {total}% {total !== 100 ? "(must equal 100%)" : ""}</div>
      </div>
    </div>
  );
}

function Residuary({ form }: { form: ReturnType<typeof useForm<WillFormType>> }) {
  const plan = form.watch("residuary") as ResiduaryPlan;
  return (
    <div className="space-y-6">
      <Controller
        control={form.control}
        name="residuary.primary.slices"
        render={({ field }) => (
          <SlicesEditor label="Primary beneficiaries of your residual estate" value={field.value || []} onChange={field.onChange} />
        )}
      />
      <Controller
        control={form.control}
        name="residuary.secondary.slices"
        render={({ field }) => (
          <SlicesEditor label="If a primary beneficiary (or beneficiaries) do not survive you" value={field.value || []} onChange={field.onChange} />
        )}
      />
      <Controller
        control={form.control}
        name="residuary.tertiary.slices"
        render={({ field }) => (
          <SlicesEditor label="If neither primary nor secondary survive" value={field.value || []} onChange={field.onChange} />
        )}
      />
      <div className="space-y-2">
        <Label className="text-white">Takers of last resort</Label>
        <Controller
          control={form.control}
          name="residuary.takersOfLastResort"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="bg-gray-900/60 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="heirs" className="text-white">Leave it to my heirs</SelectItem>
                <SelectItem value="charity" className="text-white">Leave it to charity</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {form.watch("residuary.takersOfLastResort") === "charity" && (
          <div className="space-y-2 mt-3">
            <Label className="text-white">Charity name</Label>
            <Input
              className="bg-gray-900/60 border-gray-700 text-white"
              placeholder="Enter charity name"
              {...form.register("residuary.charityName" as any)}
            />
          </div>
        )}
      </div>
      <div className="text-xs text-gray-400">
        Percentages in each block must total 100%.
      </div>
    </div>
  );
}

function Gifts({ form }: { form: ReturnType<typeof useForm<WillFormType>> }) {
  const fa = useFieldArray({ control: form.control, name: "gifts" });
  return (
    <div className="space-y-4">
      {fa.fields.map((f, i) => (
        <div key={f.id} className="rounded-lg border border-gray-700 p-3 bg-black/20 space-y-3">
          <div className="space-y-2">
            <Label className="text-white">Property description</Label>
            <Input className="bg-gray-900/60 border-gray-700 text-white" {...form.register(`gifts.${i}.description` as const)} />
          </div>
          <Controller
            control={form.control}
            name={`gifts.${i}.primary` as const}
            render={({ field }) => (
              <SlicesEditor label="Primary beneficiaries" value={field.value || []} onChange={field.onChange} />
            )}
          />
          <Controller
            control={form.control}
            name={`gifts.${i}.contingent` as const}
            render={({ field }) => (
              <SlicesEditor label="Contingent beneficiaries (optional)" value={field.value || []} onChange={field.onChange} />
            )}
          />
          <div>
            <Button
              variant="outline"
              className="bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50"
              onClick={() => fa.remove(i)}
            >
              Remove gift
            </Button>
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        className="bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50"
        onClick={() => fa.append({ description: "", primary: [] })}
      >
        Add specific gift
      </Button>
      <div className="text-xs text-gray-400">
        Specific gifts are optional; your residuary plan handles everything else.
      </div>
    </div>
  );
}

function Funeral({ form }: { form: ReturnType<typeof useForm<WillFormType>> }) {
  const fa = useFieldArray({ control: form.control, name: "funeral.agents" as any });
  const spouseName = (form.watch("spouse.name") || "").toString().trim();
  const agents = (form.watch("funeral.agents") as string[]) || [];

  const [prefilled, setPrefilled] = React.useState(false);
  useEffect(() => {
    if (prefilled) return;
    const emptyOrMissing = !agents || agents.length === 0 || agents.every((s) => !String(s || "").trim());
    if (spouseName && emptyOrMissing) {
      fa.replace([spouseName]);
      setPrefilled(true);
    }
  }, [spouseName, agents, prefilled, fa]);

  return (
    <div className="space-y-3">
      <Label className="text-white">Person(s) to carry out your funeral wishes (in order)</Label>
      <div className="space-y-2">
        {fa.fields.map((f, i) => (
          <div key={f.id} className="grid gap-2 md:grid-cols-3">
            <Input
              className="bg-gray-900/60 border-gray-700 text-white md:col-span-2"
              placeholder="Full name"
              {...form.register(`funeral.agents.${i}` as const)}
            />
            <Button
              variant="outline"
              className="bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50"
              onClick={() => fa.remove(i)}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          className="bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50"
          onClick={() => fa.append("")}
        >
          Add person
        </Button>
      </div>
      <div className="space-y-2">
        <Label className="text-white">Wishes for your funeral service (optional)</Label>
        <Textarea className="bg-gray-900/60 border-gray-700 text-white min-h-[100px]" {...form.register("funeral.serviceText")} />
      </div>
      <div className="space-y-2">
        <Label className="text-white">Wishes for your body and final resting place (optional)</Label>
        <Textarea className="bg-gray-900/60 border-gray-700 text-white min-h-[100px]" {...form.register("funeral.bodyText")} />
      </div>
    </div>
  );
}

function Provisions({ form }: { form: ReturnType<typeof useForm<WillFormType>> }) {
  const p = form.watch("provisions");
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Toggle label="Independent administration (where allowed)" value={p.independentAdmin} onChange={(v) => form.setValue("provisions.independentAdmin", v)} />
      <Toggle label="Include no‑contest clause" value={p.noContest} onChange={(v) => form.setValue("provisions.noContest", v)} />
      <Toggle label="Include self‑proving affidavit (notarized)" value={p.selfProving} onChange={(v) => form.setValue("provisions.selfProving", v)} />
      <Toggle label="Consent to notify nonprofits you name" value={p.nonprofitConsent} onChange={(v) => form.setValue("provisions.nonprofitConsent", v)} />
      <Toggle label="Include Special Needs Trust fallback language" value={p.includeSpecialNeedsTrust} onChange={(v) => form.setValue("provisions.includeSpecialNeedsTrust", v)} />
      <div className="md:col-span-2 space-y-2">
        <Label className="text-white">Personal statement (optional; not legally binding)</Label>
        <Textarea className="bg-gray-900/60 border-gray-700 text-white min-h-[100px]" {...form.register("provisions.personalStatement")} />
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-black/20 p-3">
      <div className="text-sm text-white">{label}</div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function Review({ values }: { values: WillFormType }) {
  const totalPrimary = percentTotal(values?.residuary?.primary?.slices || []);
  return (
    <div className="space-y-3 text-sm text-gray-300">
      <p><strong>Testator:</strong> {values.person.first} {values.person.middle} {values.person.last}</p>
      <p><strong>Marital status:</strong> {values.maritalStatus}{values.spouse?.name ? ` — Spouse: ${values.spouse.name}` : ""}</p>
      <p><strong>Children:</strong> {(values.children || []).map(c => c.name).join(", ") || "None"}</p>
      <p><strong>Executor:</strong> {(values.executors || [])[0]?.name || "—"}</p>
      <p><strong>Primary residuary total:</strong> {totalPrimary}%</p>
      {totalPrimary !== 100 && <p className="text-amber-300">Fix: primary residuary must total 100%.</p>}
      <p className="text-xs text-gray-500">Click Generate to create: instructions, will, property memo, digital assets sheet, funeral wishes, beneficiary messages, and a self‑proving affidavit (HTML versions).</p>
    </div>
  );
}
