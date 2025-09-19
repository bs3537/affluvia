import React, { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
                    onClick={() => { setStep(1); setGenerated(false); }}
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
  const mode = form.watch("assets?.mode" as any) as "list" | "estimate" | undefined;

  // Pull the user profile to surface assets (manual + Plaid) and home equity
  const { data: profile } = useQuery({
    queryKey: ["/api/financial-profile"],
    queryFn: async () => {
      const response = await fetch("/api/financial-profile", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch profile");
      return response.json();
    },
  });

  const totalAssets = useMemo(() => {
    if (!profile) return 0;
    let total = 0;
    // Manual assets
    if (Array.isArray(profile.assets)) {
      total += profile.assets.reduce((sum: number, a: any) => sum + (Number(a?.value) || 0), 0);
    }
    // Plaid accounts if present on profile (best-effort)
    if (Array.isArray(profile.plaidAccounts)) {
      total += profile.plaidAccounts.reduce((sum: number, acc: any) => sum + (Number(acc?.balance) || 0), 0);
    }
    // Primary residence equity
    if (profile.primaryResidence) {
      const mv = Number(profile.primaryResidence.marketValue) || 0;
      const mb = Number(profile.primaryResidence.mortgageBalance) || 0;
      total += Math.max(0, mv - mb);
    }
    return total;
  }, [profile]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
      Math.round(n || 0)
    );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-white">How would you like to provide assets?</Label>
        <div className="grid gap-2 md:grid-cols-2">
          <Button
            variant={mode === "list" ? "default" : "outline"}
            className={mode === "list" ? "bg-purple-600 hover:bg-purple-500 text-white" : "bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50"}
            onClick={() => form.setValue("assets.mode" as any, "list")}
          >
            List each major asset
          </Button>
          <Button
            variant={mode === "estimate" ? "default" : "outline"}
            className={mode === "estimate" ? "bg-purple-600 hover:bg-purple-500 text-white" : "bg-gray-800/50 border-gray-600 text-gray-200 hover:bg-gray-700/50"}
            onClick={() => form.setValue("assets.mode" as any, "estimate")}
          >
            Estimate total for now
          </Button>
        </div>
      </div>

      {totalAssets > 0 && (
        <div className="rounded-lg border border-emerald-700 bg-emerald-900/20 p-3">
          <div className="text-sm text-emerald-200">
            <strong>Assets from your profile:</strong> {fmt(totalAssets)}
          </div>
          <div className="text-xs text-emerald-300 mt-1">This includes your manual entries and Plaid-connected accounts.</div>
        </div>
      )}

      {mode === "estimate" && (
        <div className="space-y-2">
          <Label className="text-white">Approximate value (range)</Label>
          <Controller
            control={form.control}
            name={"assets.estimateBracket" as any}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="bg-gray-900/60 border-gray-700 text-white">
                  <SelectValue placeholder="Select a range" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {["Less than $200k", "$200k–$500k", "$500k–$1M", "$1M–$2M", "$2M–$5M", "$5M–$10M", "More than $10M"].map((r) => (
                    <SelectItem key={r} value={r} className="text-white">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      {mode === "list" && (
        <div className="space-y-3">
          <div className="text-sm text-gray-400">Assets from your profile are shown below. You can reference these in your will or add additional items.</div>
          {profile && (
            <div className="space-y-2">
              {Array.isArray(profile.assets) && profile.assets.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-white mb-2">Manual Assets:</div>
                  {profile.assets.map((asset: any, i: number) => (
                    <div key={`ma-${i}`} className="text-sm text-gray-300 bg-gray-800/30 p-2 rounded">
                      {(asset.name || asset.type || "Asset")} : {fmt(Number(asset.value) || 0)}
                    </div>
                  ))}
                </div>
              )}

              {Array.isArray(profile.plaidAccounts) && profile.plaidAccounts.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-white mb-2">Connected Accounts:</div>
                  {profile.plaidAccounts.map((acc: any, i: number) => (
                    <div key={`pa-${i}`} className="text-sm text-gray-300 bg-gray-800/30 p-2 rounded">
                      {(acc.name || acc.type || "Account")} : {fmt(Number(acc.balance) || 0)}
                    </div>
                  ))}
                </div>
              )}

              {profile.primaryResidence && (
                <div>
                  <div className="text-sm font-medium text-white mb-2">Primary Residence:</div>
                  <div className="text-sm text-gray-300 bg-gray-800/30 p-2 rounded">
                    Home Equity: {fmt(Math.max(0, (Number(profile.primaryResidence.marketValue) || 0) - (Number(profile.primaryResidence.mortgageBalance) || 0)))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
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
  const gifts = form.watch("gifts") || [];
  return (
    <div className="space-y-4">
      {gifts.map((g, i) => (
        <div key={i} className="rounded-lg border border-gray-700 p-3 bg-black/20 space-y-3">
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
  const agents = form.watch("funeral.agents") || [];
  return (
    <div className="space-y-3">
      <Label className="text-white">Person(s) to carry out your funeral wishes (in order)</Label>
      <div className="space-y-2">
        {(agents as string[]).map((a: string, i: number) => (
          <div key={`${a}-${i}`} className="grid gap-2 md:grid-cols-3">
            <Input className="bg-gray-900/60 border-gray-700 text-white md:col-span-2" value={a} onChange={(e) => form.setValue(`funeral.agents.${i}` as any, e.target.value)} />
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
