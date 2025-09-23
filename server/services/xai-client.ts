import 'dotenv/config';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export interface ChatOptions {
  temperature?: number;
  stream?: boolean;
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
  const finalMessages: ChatMessage[] = [guard, personalization, metricsGuard, debtPolicy, ...messages];

  const body = {
    model: 'grok-4-fast-reasoning',
    messages: finalMessages,
    temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.7,
    stream: !!opts.stream,
  } as any;

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await safeText(res);
    throw new Error(`XAI error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content) {
    throw new Error('XAI response missing content');
  }
  return content;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
