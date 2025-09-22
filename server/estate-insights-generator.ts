import { GoogleGenerativeAI } from "@google/generative-ai";
import crypto from "node:crypto";
import { storage } from "./storage";
import type {
  EstatePlan,
  EstateDocument,
  EstateBeneficiary,
  EstateScenario,
  EstateTrust,
  FinancialProfile,
} from "@shared/schema";

const GEMINI_MODEL = "gemini-2.5-flash-lite";

const isUndefinedTableError = (error: unknown): boolean => {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in (error as Record<string, unknown>) &&
    (error as { code?: string }).code === "42P01"
  );
};

function getAgeFromISO(date?: string | null): number | undefined {
  if (!date) return undefined;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const diff = Date.now() - parsed.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
}

function summarizeDocuments(documents: EstateDocument[] = []) {
  return documents.map((doc) => ({
    id: doc.id,
    type: doc.documentType,
    name: doc.documentName,
    status: doc.status,
    forSpouse: doc.forSpouse,
    lastReviewDate: doc.lastReviewDate,
    executionDate: doc.executionDate,
  }));
}

function summarizeBeneficiaries(beneficiaries: EstateBeneficiary[] = []) {
  return beneficiaries.map((beneficiary) => ({
    id: beneficiary.id,
    name: beneficiary.name,
    relationship: beneficiary.relationship,
    distributionType: beneficiary.distributionType,
    distributionPercentage: beneficiary.distributionPercentage,
    distributionAmount: beneficiary.distributionAmount,
    isPrimary: beneficiary.isPrimary,
  }));
}

function summarizeScenarios(scenarios: EstateScenario[] = []) {
  return scenarios.map((scenario) => ({
    id: scenario.id,
    name: scenario.scenarioName,
    type: scenario.scenarioType,
    description: scenario.description,
    netToHeirs: scenario.netToHeirs,
    totalTaxes: scenario.totalTaxes,
    isBaseline: scenario.isBaseline,
  }));
}

function summarizeTrusts(trusts: EstateTrust[] = []) {
  return trusts.map((trust) => ({
    id: trust.id,
    name: trust.trustName,
    type: trust.trustType,
    currentValue: trust.currentValue,
    establishedDate: trust.establishedDate,
  }));
}

function buildProfileSummary(profile: FinancialProfile | null) {
  if (!profile) return null;
  const currentAge = getAgeFromISO(profile.dateOfBirth);
  const spouseAge = getAgeFromISO(profile.spouseDateOfBirth);
  const monthlyExpenses = profile.monthlyExpenses || {};
  const totalMonthlyExpenses = Object.values(monthlyExpenses).reduce((sum, value) => sum + Number(value || 0), 0);

  const assets = Array.isArray(profile.assets) ? profile.assets : [];
  const liabilities = Array.isArray(profile.liabilities) ? profile.liabilities : [];

  const assetSummary = assets.map((asset: any) => ({
    type: asset.type,
    owner: asset.owner,
    name: asset.name || asset.description || undefined,
    value: asset.value,
  }));

  const liabilitySummary = liabilities.map((liability: any) => ({
    type: liability.type,
    name: liability.name || liability.description || undefined,
    balance: liability.balance,
    interestRate: liability.interestRate,
  }));

  const calculations = (profile as any).calculations || {};

  return {
    name: profile.firstName,
    spouseName: profile.spouseName,
    currentAge,
    spouseAge,
    maritalStatus: profile.maritalStatus,
    state: profile.state,
    annualIncome: profile.annualIncome,
    spouseAnnualIncome: profile.spouseAnnualIncome,
    legacyGoal: profile.legacyGoal,
    emergencyFundSize: profile.emergencyFundSize,
    monthlyExpenses: totalMonthlyExpenses,
    expenseBreakdown: monthlyExpenses,
    assets: assetSummary,
    liabilities: liabilitySummary,
    netWorth: calculations.netWorth ?? profile.netWorth,
    monthlyCashFlow: calculations.monthlyCashFlow ?? profile.monthlyCashFlow,
    retirementReadinessScore: calculations.retirementReadinessScore ?? profile.retirementReadinessScore,
    riskManagementScore: calculations.riskManagementScore ?? profile.riskManagementScore,
  };
}

function buildEstatePlanSummary(estatePlan: EstatePlan) {
  const estateNew = (estatePlan.analysisResults as any)?.estateNew || {};
  const baseline = estateNew?.summaries?.baseline;
  const withRoth = estateNew?.summaries?.withRoth;

  return {
    totalEstateValue: estatePlan.totalEstateValue,
    liquidAssets: estatePlan.liquidAssets,
    illiquidAssets: estatePlan.illiquidAssets,
    includeRoth: estateNew?.includeRoth ?? false,
    strategies: estateNew?.strategies || (estatePlan.analysisResults as any)?.strategies || {},
    assumptions: estateNew?.assumptions || (estatePlan.analysisResults as any)?.assumptions || {},
    gifting: (estatePlan.analysisResults as any)?.gifting || {},
    insurance: (estatePlan.analysisResults as any)?.insurance || {},
    charitable: (estatePlan.analysisResults as any)?.charitable || estatePlan.charitableGifts || {},
    baselineSummary: baseline,
    withRothSummary: withRoth,
    charts: estateNew?.charts,
    liquidity: baseline?.liquidity,
    taxSummary: baseline
      ? {
          estateTax: baseline.totalTax,
          federalTax: baseline.federalTax,
          stateTax: baseline.stateTax,
          netToHeirs: baseline.netToHeirs,
        }
      : undefined,
  };
}

function hashContext(payload: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export interface EstateInsightsContext {
  profile: ReturnType<typeof buildProfileSummary>;
  estatePlanSummary: ReturnType<typeof buildEstatePlanSummary>;
  documents: ReturnType<typeof summarizeDocuments>;
  beneficiaries: ReturnType<typeof summarizeBeneficiaries>;
  trusts: ReturnType<typeof summarizeTrusts>;
  scenarios: ReturnType<typeof summarizeScenarios>;
  generatedAt: string;
}

export interface EstateInsightRecommendation {
  priority: number;
  title: string;
  summary: string;
  actionItems: string[];
  impact: {
    type: string;
    description: string;
    estimatedDelta?: string;
  };
}

export interface EstateInsightsPayload {
  generatedAt: string;
  recommendations: EstateInsightRecommendation[];
  model: string;
  contextHash: string;
  raw?: string;
}

export async function assembleEstateInsightsContext(userId: number, estatePlan?: EstatePlan | null): Promise<EstateInsightsContext> {
  const profile = await storage.getFinancialProfile(userId);
  const resolvedPlan = estatePlan ?? (await storage.getEstatePlan(userId));
  if (!resolvedPlan) {
    throw new Error("Estate plan not found for user");
  }

  const estatePlanId = resolvedPlan.id;
  const documentsPromise = storage.getEstateDocuments(userId, estatePlanId).catch((error) => {
    if (isUndefinedTableError(error)) return [] as EstateDocument[];
    throw error;
  });

  const beneficiariesPromise = storage
    .getEstateBeneficiaries(userId, estatePlanId)
    .catch((error) => {
      if (isUndefinedTableError(error)) return [] as EstateBeneficiary[];
      throw error;
    });

  const trustsPromise = storage.getEstateTrusts(userId, estatePlanId).catch((error) => {
    if (isUndefinedTableError(error)) return [] as EstateTrust[];
    throw error;
  });

  const scenariosPromise = storage.getEstateScenarios(userId, estatePlanId).catch((error) => {
    if (isUndefinedTableError(error)) return [] as EstateScenario[];
    throw error;
  });

  const [documents, beneficiaries, trusts, scenarios] = await Promise.all([
    documentsPromise,
    beneficiariesPromise,
    trustsPromise,
    scenariosPromise,
  ]);

  const context: EstateInsightsContext = {
    profile: buildProfileSummary(profile),
    estatePlanSummary: buildEstatePlanSummary(resolvedPlan),
    documents: summarizeDocuments(documents),
    beneficiaries: summarizeBeneficiaries(beneficiaries),
    trusts: summarizeTrusts(trusts),
    scenarios: summarizeScenarios(scenarios),
    generatedAt: new Date().toISOString(),
  };

  return context;
}

export async function generateEstateInsightsFromContext(context: EstateInsightsContext): Promise<EstateInsightsPayload> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }

  const systemPrompt = [
    "You are Affluvia's in-house estate planning strategist.",
    "Think hard.",
    "Blend the acumen of a CFP, estate attorney, and tax strategist.",
    "Always focus on maximizing after-tax, after-cost estate value for the household.",
    "Consider liquidity, taxes, probate frictions, beneficiary alignment, and charitable intent.",
    "Reference the provided data precisely; do not fabricate figures.",
    "Recommendations must be personalized, actionable, and compliant with U.S. estate planning norms.",
  ].join(" ");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: {
      role: "system",
      parts: [{ text: systemPrompt }],
    },
  });

  const contextHash = hashContext(context);

  const guidance = `You are given estate-planning context for a household as JSON. Using ONLY this data:
1. Produce at least five (5) distinct recommendations focused on growing the household's after-tax, after-cost estate value.
2. Rank them in order of urgency (1 = highest priority).
3. Each recommendation must include:
   - "title": concise name.
   - "summary": 2-3 sentence rationale tying directly to the client's facts.
   - "actionItems": bullet list (3-5) of specific next steps.
   - "impact": object with "type" (e.g., "tax savings", "liquidity", "risk mitigation", "legacy", "trust optimization"), "description" (quantify or explain benefit), and optional "estimatedDelta" string when estimation is feasible.
4. Consider Roth conversion settings, liquidity gaps, document gaps, beneficiary misalignments, gifting strategies, and state-specific tax nuances when relevant.
5. If data appears stale or missing, call that out within the summary and suggest how to resolve it.
6. Output valid JSON matching the schema:
{
  "recommendations": [
    {
      "priority": number,
      "title": string,
      "summary": string,
      "actionItems": string[],
      "impact": {
        "type": string,
        "description": string,
        "estimatedDelta"?: string
      }
    }
  ]
}
Ensure priorities are unique integers starting at 1 and incrementing by 1.`;

  const userContent = `ESTATE CONTEXT (JSON):\n${JSON.stringify(context, null, 2)}\n\nINSTRUCTIONS:\n${guidance}`;

  const result = await model.generateContent(userContent);
  const text = result.response.text();

  const jsonMatch = extractFirstJson(text);
  if (!jsonMatch) {
    throw new Error("Gemini response did not contain parseable JSON");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch);
  } catch (error) {
    throw new Error(`Failed to parse Gemini response JSON: ${(error as Error).message}`);
  }

  const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
  const normalized = recommendations
    .map((item: any, index: number) => ({
      priority: Number.isFinite(item.priority) ? Number(item.priority) : index + 1,
      title: String(item.title || `Recommendation ${index + 1}`),
      summary: String(item.summary || ""),
      actionItems: Array.isArray(item.actionItems)
        ? item.actionItems.map((a: any) => String(a)).filter(Boolean)
        : [],
      impact: {
        type: String(item.impact?.type || "unspecified"),
        description: String(item.impact?.description || ""),
        estimatedDelta: item.impact?.estimatedDelta ? String(item.impact.estimatedDelta) : undefined,
      },
    }))
    .filter((rec: EstateInsightRecommendation) => rec.title && rec.summary)
    .slice(0, 8);

  if (normalized.length < 5) {
    throw new Error("Gemini returned fewer than 5 recommendations");
  }

  return {
    generatedAt: new Date().toISOString(),
    recommendations: normalized.sort((a, b) => a.priority - b.priority),
    model: GEMINI_MODEL,
    contextHash,
    raw: text,
  };
}

function extractFirstJson(text: string): string | null {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const candidate = text.substring(firstBrace, lastBrace + 1);
  return candidate;
}
