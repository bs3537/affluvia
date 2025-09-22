import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from './db';
import { debts as debtsTable, debtPayoffPlans, debtScenarios, debtAIInsights } from '../shared/schema';
import { and, desc, eq } from 'drizzle-orm';

type UiInsight = {
  id: string;
  type: 'recommendation' | 'warning' | 'opportunity' | 'tip';
  title: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  potentialSavings?: number;
  relatedDebtId?: number;
};

function toNumber(n: any): number {
  if (typeof n === 'number') return n;
  const x = parseFloat(n ?? '0');
  return Number.isFinite(x) ? x : 0;
}

function computeSummary(debts: any[]) {
  const active = debts.filter(d => d.status === 'active');
  const totalDebt = active.reduce((s, d) => s + toNumber(d.currentBalance), 0);
  const totalMinimumPayment = active.reduce((s, d) => s + toNumber(d.minimumPayment), 0);
  const averageInterestRate = active.length > 0
    ? active.reduce((s, d) => s + (toNumber(d.annualInterestRate) * toNumber(d.currentBalance)), 0) / (totalDebt || 1)
    : 0;
  const highestInterestDebt = active.reduce((max: any, d) => (toNumber(d.annualInterestRate) > toNumber(max?.annualInterestRate || 0) ? d : max), null as any);
  const lowestBalanceDebt = active.reduce((min: any, d) => (toNumber(d.currentBalance) < toNumber(min?.currentBalance ?? Infinity) ? d : min), null as any);
  return { totalDebt, totalMinimumPayment, averageInterestRate, highestInterestDebt, lowestBalanceDebt, activeDebtsCount: active.length };
}

export async function generateDebtInsightsForUser(userId: number): Promise<{ insights: UiInsight[]; prompt: string; context: any }> {
  // 1) Gather DB context
  const userDebts = await db
    .select()
    .from(debtsTable)
    .where(and(eq(debtsTable.userId, userId)));

  const [activePlan] = await db
    .select({
      id: debtPayoffPlans.id,
      planName: (debtPayoffPlans as any).planName,
      strategy: (debtPayoffPlans as any).strategy,
      extraMonthlyPayment: (debtPayoffPlans as any).extraMonthlyPayment,
      payoffDate: (debtPayoffPlans as any).payoffDate,
      totalInterestPaid: (debtPayoffPlans as any).totalInterestPaid,
      totalAmountPaid: (debtPayoffPlans as any).totalAmountPaid,
      monthsToPayoff: (debtPayoffPlans as any).monthsToPayoff,
    })
    .from(debtPayoffPlans)
    .where(and(eq(debtPayoffPlans.userId, userId), eq(debtPayoffPlans.isActive, true)))
    .limit(1);

  const scenarios = await db
    .select()
    .from(debtScenarios)
    .where(eq(debtScenarios.userId, userId))
    .orderBy(desc(debtScenarios.createdAt))
    .limit(20);

  const summary = computeSummary(userDebts as any[]);

  // 2) Build Gemini model with systemInstruction that includes “Think Hard”
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction:
      'Think Hard. You are a CFP crafting debt management insights. Use the provided JSON context only. Provide at least five ranked, highly personalized recommendations with action steps and quantified monetary impact. Return strict JSON only.'
  } as any);

  // 3) Compose prompt with full debt context
  const context = {
    userId,
    debts: (userDebts as any[]).map(d => ({
      id: d.id,
      name: d.debtName,
      type: d.debtType,
      currentBalance: toNumber(d.currentBalance),
      originalBalance: toNumber(d.originalBalance),
      annualInterestRate: toNumber(d.annualInterestRate),
      minimumPayment: toNumber(d.minimumPayment),
      paymentDueDate: d.paymentDueDate,
      status: d.status,
      isSecured: d.isSecured,
      isIncludedInPayoff: d.isIncludedInPayoff,
      lender: d.lender
    })),
    activePlan: activePlan ? {
      id: (activePlan as any).id,
      planName: (activePlan as any).planName,
      strategy: (activePlan as any).strategy,
      extraMonthlyPayment: toNumber((activePlan as any).extraMonthlyPayment),
      payoffDate: (activePlan as any).payoffDate,
      totalInterestPaid: toNumber((activePlan as any).totalInterestPaid),
      totalAmountPaid: toNumber((activePlan as any).totalAmountPaid),
      monthsToPayoff: (activePlan as any).monthsToPayoff
    } : null,
    whatIfScenarios: (scenarios as any[]).map(s => ({
      id: s.id,
      name: (s as any).scenarioName,
      type: (s as any).scenarioType,
      parameters: (s as any).parameters,
      results: (s as any).results,
      payoffDate: (s as any).payoffDate,
      totalInterestPaid: toNumber((s as any).totalInterestPaid),
      monthsToPayoff: (s as any).monthsToPayoff,
      monthsSaved: (s as any).monthsSaved,
      interestSaved: toNumber((s as any).interestSaved)
    })),
    summary
  };

  const outputSpec = {
    format: 'Return ONLY JSON with this structure',
    schema: {
      insights: [
        {
          id: 'string',
          type: "'recommendation' | 'warning' | 'opportunity' | 'tip'",
          title: 'string',
          content: 'string',
          actionItems: ['string', '...'],
          monetaryImpact: {
            interestSaved1Year: 'number',
            interestSavedTotal: 'number',
            monthsSaved: 'number',
            cashFlowImprovementPerMonth: 'number'
          },
          relatedDebtId: 'number | null',
          priorityRank: 'number (1 = highest)'
        }
      ]
    }
  };

  const prompt = [
    'You are generating debt management insights. Rank by priority (1 highest).',
    'Requirements:',
    '- Use all debts, the active payoff plan (including hybrid), and all what-if scenarios.',
    '- Provide at least 5 insights; each must include actionItems (3-5 steps) and quantified monetaryImpact.',
    '- Prefer actionable items with specific dollar amounts, months saved, and APR context.',
    '- If consolidation or rate-change scenarios exist, reference them with expected impact.',
    '- Output strictly the JSON schema described; no prose outside JSON.'
  ].join('\n');

  const generationInput = `CONTEXT_JSON:\n${JSON.stringify(context)}\n\n${outputSpec.format}:\n${JSON.stringify(outputSpec.schema, null, 2)}`;

  let insights: UiInsight[] = [];
  try {
    const result = await model.generateContent(generationInput);
    const text = (await result.response).text();
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/({[\s\S]*})/);
    const raw = JSON.parse(jsonMatch?.[1] || text);
    insights = (raw.insights || []).map((i: any) => {
      const baseContent = i.content || 'See action steps to improve your payoff trajectory.';
      const steps = Array.isArray(i.actionItems) && i.actionItems.length > 0
        ? '\nActions:\n- ' + i.actionItems.slice(0, 5).join('\n- ')
        : '';
      return ({
        id: String(i.id || cryptoRandomId()),
        type: (i.type === 'warning' || i.type === 'opportunity' || i.type === 'tip') ? i.type : 'recommendation',
        title: i.title || 'Debt Optimization Recommendation',
        content: baseContent + steps,
        priority: ((): 'high' | 'medium' | 'low' => {
          const r = toNumber(i.priorityRank || i.priority || 2);
          if (r <= 2) return 'high';
          if (r <= 4) return 'medium';
          return 'low';
        })(),
        actionable: Array.isArray(i.actionItems) && i.actionItems.length > 0,
        potentialSavings: toNumber(i.monetaryImpact?.interestSaved1Year || i.monetaryImpact?.interestSavedTotal || 0),
        relatedDebtId: i.relatedDebtId ? Number(i.relatedDebtId) : undefined
      });
    });
  } catch (e) {
    // Fallback deterministic insights
    const hi = summary.highestInterestDebt;
    const lb = summary.lowestBalanceDebt;
    const total = summary.totalDebt;
    const avgApr = summary.averageInterestRate;
    if (hi) {
      insights.push({
        id: cryptoRandomId(),
        type: 'recommendation',
        title: `Target highest-rate debt: ${hi.debtName} (${toNumber(hi.annualInterestRate).toFixed(1)}% APR)`,
        content: `Redirect any extra payments to ${hi.debtName}. This accelerates payoff and reduces lifetime interest.`,
        priority: 'high',
        actionable: true,
        potentialSavings: Math.round(toNumber(hi.currentBalance) * toNumber(hi.annualInterestRate) / 100 * 0.25)
      });
    }
    if (lb) {
      insights.push({
        id: cryptoRandomId(),
        type: 'opportunity',
        title: `Quick win: pay off ${lb.debtName}`,
        content: `Paying off your smallest balance builds momentum and frees up ${toNumber(lb.minimumPayment).toLocaleString('en-US',{style:'currency',currency:'USD'})}/mo for snowballing.`,
        priority: 'high',
        actionable: true,
        potentialSavings: Math.round(toNumber(lb.currentBalance) * 0.02)
      });
    }
    insights.push({
      id: cryptoRandomId(),
      type: 'tip',
      title: 'Add $100 extra toward principal each month',
      content: 'Apply the extra to the highest-APR debt until paid, then roll it to the next (avalanche).',
      priority: 'medium',
      actionable: true,
      potentialSavings: Math.round(total * 0.01)
    });
    if (avgApr && avgApr > 0) {
      insights.push({
        id: cryptoRandomId(),
        type: 'recommendation',
        title: `Consider consolidation below ${(avgApr - 3).toFixed(1)}% APR`,
        content: 'If eligible, a lower fixed-rate consolidation could reduce interest costs and simplify payments.',
        priority: 'medium',
        actionable: true,
        potentialSavings: Math.round(total * 0.03)
      });
    }
    insights.push({
      id: cryptoRandomId(),
      type: 'tip',
      title: 'Set up autopay for all debts',
      content: 'Avoid late fees and ensure on-time payments to protect your credit and interest rates.',
      priority: 'low',
      actionable: true,
      potentialSavings: Math.round(total * 0.005)
    });
  }

  // Sort by priority then by potential savings
  insights.sort((a, b) => {
    const pri = (p: UiInsight['priority']) => (p === 'high' ? 0 : p === 'medium' ? 1 : 2);
    const pa = pri(a.priority) - pri(b.priority);
    if (pa !== 0) return pa;
    return (b.potentialSavings || 0) - (a.potentialSavings || 0);
  });

  // Guarantee at least 5
  if (insights.length < 5) {
    // Create minimal filler items to meet the contract
    for (let k = insights.length; k < 5; k++) {
      insights.push({
        id: cryptoRandomId(),
        type: 'recommendation',
        title: 'Increase principal payment by $100/month',
        content: 'Applying an extra $100 toward highest-APR debt accelerates payoff and reduces total interest.',
        priority: 'medium',
        actionable: true,
        potentialSavings: Math.round(summary.totalDebt * 0.01)
      });
    }
  }

  // 4) Persist to debt_ai_insights (replace current active rows)
  // Soft approach: mark old as inactive, then insert fresh
  await db.update(debtAIInsights)
    .set({ isActive: false })
    .where(eq(debtAIInsights.userId, userId));

  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (insights.length > 0) {
    for (const ins of insights.slice(0, 12)) {
      await db.insert(debtAIInsights).values({
        userId,
        insightType: ins.type === 'warning' ? 'warning' : (ins.type === 'opportunity' ? 'optimization_tip' : 'strategy_recommendation'),
        insightTitle: ins.title,
        insightContent: ins.content,
        relatedDebtId: ins.relatedDebtId,
        relatedPlanId: (activePlan as any)?.id,
        priority: ins.priority === 'high' ? 3 : ins.priority === 'medium' ? 2 : 1,
        isActionable: ins.actionable,
        actionTaken: false,
        validUntil,
        isActive: true
      } as any);
    }
  }

  return { insights, prompt, context };
}

function cryptoRandomId(): string {
  // Simple random id fallback without importing crypto
  return Math.random().toString(36).slice(2, 10);
}
