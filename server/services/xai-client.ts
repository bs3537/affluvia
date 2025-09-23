import 'dotenv/config';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export interface ChatOptions {
  temperature?: number;
  stream?: boolean;
  timeoutMs?: number;
  model?: string;
}

/**
 * Minimal X.AI client wrapper for chat completions.
 * Keeps prompts unchanged; callers pass a single big user message
 * or include a system message as needed.
 */
export async function chatComplete(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI API key not configured');
  }

  // Always prepend anti-hallucination guard and personalization/data-source rules
  const guard: ChatMessage = {
    role: 'system',
    content: 'Do not hallucinate. All your recommendations should be based on facts and data. Do not make up any facts or data.'
  };
  const personalization: ChatMessage = {
    role: 'system',
    content:
      'Personalize insights and recommendations using the user/spouse/child names when available. '
      + 'Always prioritize saved/persisted dashboard metrics and profile data over recomputing or inferring values; '
      + 'treat saved values as authoritative for Emergency Readiness, Savings Rate, Insurance Adequacy, and Retirement metrics.'
  };
  const metricsGuard: ChatMessage = {
    role: 'system',
    content: 'Do not invent metrics that were not provided (e.g., no "Cash Flow Health Score"). If a metric is not provided, omit it rather than fabricating values or labels.'
  };
  const debtPolicy: ChatMessage = {
    role: 'system',
    content:
      'Debt Management Policy: When recommending debt payoff strategies, default to the app\'s Hybrid approach (Snowball + Avalanche). '
      + 'Use quick-win momentum from small balances while prioritizing highest-interest debts with surplus. '
      + 'Do NOT recommend pure Avalanche or pure Snowball as the default unless explicitly requested or strictly superior based on the user\'s data. '
      + 'Always include a call to action to visit the Debt Management Center for detailed strategy, scenario comparisons, and execution steps. '
      + 'Ensure all debt insights align with this policy and do not contradict the built-in Debt Management tools.'
  };
  const emergencyFundPolicy: ChatMessage = {
    role: 'system',
    content:
      // Core policy
      'Emergency Fund Policy (Affluvia): Use a STANDARD TARGET of EXACTLY 6 months of ESSENTIAL monthly expenses for all users, including self-employed. '
      + 'Do NOT suggest 9–12 months by default. Only mention a target other than 6 months if an explicit field in the provided data overrides it (e.g., emergencyFundTargetMonths) or the user has chosen a different target. '
      
      // Source of truth & computation
      + 'Base amounts on essential expenses captured in the intake categories, not on gross/total expenses or income. '
      + 'When data provides a canonical value (financialMetrics.emergencyFundTarget, emergencyMonths, emergencyReadinessScore/emergencyScore), treat those as authoritative and do not recompute months. '
      + 'If you must compute, derive ESSENTIAL monthly expenses by excluding discretionary categories such as dining, entertainment, shopping, travel/vacation, subscriptions/streaming, hobbies, gifts, alcohol, recreation, personalCare, luxury, misc. '
      + 'If an explicit essential value exists (monthlyExpenses.essential or profileData.essentialMonthlyExpenses), prefer it. '
      
      // Copy guidance
      + 'In copy and calculations, reflect the 6-month target (e.g., “Target Emergency Fund: 6 months of essential expenses”). '
      + 'Avoid language that escalates to longer horizons unless the user explicitly opts in. '
      + 'When showing dollars, multiply the essential monthly amount by 6 and round sensibly.'
  };
  const retirementPolicy: ChatMessage = {
    role: 'system',
    content:
      'Retirement Planning Policy (Affluvia): Optimize recommendations toward achieving a Monte Carlo retirement success probability of at least 80% (0-100), using the dashboard\'s probabilityOfSuccess as the canonical metric. '
      + 'Do not use or optimize toward any "retirement target income" figure for retirement-related goals or insights; treat any target income as informational only. '
      + 'If current probability is below 80%, prioritize actions that raise it. If at or above 80%, avoid recommendations likely to reduce it below 80%. '
      + 'When proposing strategies (e.g., Roth conversions, allocation shifts, withdrawal changes), ensure they support the 80%+ objective or explicitly caution if user-provided constraints necessitate otherwise.'
  };
  const finalMessages: ChatMessage[] = [guard, personalization, metricsGuard, debtPolicy, emergencyFundPolicy, retirementPolicy, ...messages];

  const model = opts.model || process.env.XAI_MODEL || 'grok-4-fast-reasoning';
  const rawTimeout = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : Number(process.env.XAI_TIMEOUT_MS || 15000);
  const timeoutMs = Number.isFinite(rawTimeout) ? rawTimeout : 15000;
  const useTimeout = timeoutMs > 0;
  const controller = useTimeout ? new AbortController() : null;
  const timer = useTimeout ? setTimeout(() => controller!.abort(), timeoutMs) : null;

  const body = {
    model,
    messages: finalMessages,
    temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.7,
    stream: !!opts.stream,
  } as any;

  let res: Response;
  try {
    res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller?.signal,
    });
  } catch (err: any) {
    if (useTimeout && err?.name === 'AbortError') {
      throw new Error(`XAI timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await safeText(res);
    throw new Error(`XAI error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content) {
    throw new Error('XAI response missing content');
  }
  // Optional lightweight log for debugging latency/model selection
  try { console.info(`[AI] model=${model} timeoutMs=${useTimeout ? timeoutMs : 0}`); } catch {}
  return content;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
