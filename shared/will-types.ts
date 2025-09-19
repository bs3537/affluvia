import { z } from "zod";

// Core beneficiary slice used for residuary and gifts
export const BeneficiarySlice = z.object({
  kind: z.enum(["person", "charity"]),
  name: z.string().min(1),
  refId: z.string().optional(),
  percent: z.number().min(0).max(100),
  notes: z.string().optional(),
});

export type BeneficiarySlice = z.infer<typeof BeneficiarySlice>;

export const ResiduaryPlan = z.object({
  primary: z.object({ slices: z.array(BeneficiarySlice) }).strict(),
  secondary: z.object({ slices: z.array(BeneficiarySlice) }).strict().optional(),
  tertiary: z.object({ slices: z.array(BeneficiarySlice) }).strict().optional(),
  takersOfLastResort: z.enum(["heirs", "charity"]).default("heirs"),
  charityName: z.string().optional(),
});

export type ResiduaryPlan = z.infer<typeof ResiduaryPlan>;

export const ExecutorNominee = z.object({
  name: z.string().min(1),
  relationship: z.string().optional(),
});

export type ExecutorNominee = z.infer<typeof ExecutorNominee>;

export const WillForm = z.object({
  person: z.object({
    first: z.string().min(1),
    middle: z.string().optional(),
    last: z.string().min(1),
    city: z.string().optional(),
    state: z.string().optional(),
    address: z.string().optional(),
  }),
  maritalStatus: z.enum(["single", "married", "domesticPartnership"]).default("single"),
  spouse: z.object({ name: z.string() }).optional(),
  children: z
    .array(
      z.object({ name: z.string().min(1), isMinor: z.boolean().default(false) })
    )
    .default([]),
  executors: z.array(ExecutorNominee).min(1),
  digitalExecutor: z
    .object({ useSame: z.boolean().default(true), nominee: ExecutorNominee.optional(), accessComms: z.boolean().default(true) })
    .default({ useSame: true, accessComms: true }),
  residuary: ResiduaryPlan,
  gifts: z
    .array(
      z.object({
        description: z.string().min(1),
        primary: z.array(BeneficiarySlice).min(1),
        contingent: z.array(BeneficiarySlice).optional(),
      })
    )
    .default([]),
  provisions: z.object({
    independentAdmin: z.boolean().default(true),
    noContest: z.boolean().default(true),
    selfProving: z.boolean().default(true),
    nonprofitConsent: z.boolean().default(false),
    includeSpecialNeedsTrust: z.boolean().default(true),
    personalStatement: z.string().optional(),
  }),
  funeral: z
    .object({ agents: z.array(z.string()).min(1), serviceText: z.string().optional(), bodyText: z.string().optional() })
    .default({ agents: [] }),
  messages: z.array(z.object({ target: z.string(), text: z.string().optional() })).default([]),
});

export type WillForm = z.infer<typeof WillForm>;

// Render context fed to template renderer
export type WillRenderContext = {
  fullName: string;
  city?: string;
  state?: string;
  spouseName?: string;
  children: string[];
  executors: ExecutorNominee[];
  digitalExecutor?: ExecutorNominee;
  residuary: ResiduaryPlan;
  gifts: Array<{ description: string; primary: BeneficiarySlice[]; contingent?: BeneficiarySlice[] }>;
  provisions: WillForm["provisions"];
  todayISO: string;
};

export function toRenderContext(form: WillForm): WillRenderContext {
  const fullName = [form.person.first, form.person.middle, form.person.last].filter(Boolean).join(" ");
  const digitalExecutor = form.digitalExecutor.useSame
    ? form.executors[0]
    : form.digitalExecutor.nominee || form.executors[0];
  return {
    fullName,
    city: form.person.city,
    state: form.person.state,
    spouseName: form.spouse?.name,
    children: (form.children || []).map((c) => c.name),
    executors: form.executors,
    digitalExecutor,
    residuary: form.residuary,
    gifts: form.gifts,
    provisions: form.provisions,
    todayISO: new Date().toISOString().slice(0, 10),
  };
}
