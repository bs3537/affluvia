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

  // Always prepend anti-hallucination guard for insights/recommendations
  const guard: ChatMessage = {
    role: 'system',
    content: 'Do not hallucinate. All your recommendations should be based on facts and data. Do not make up any facts or data.'
  };
  const finalMessages: ChatMessage[] = [guard, ...messages];

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
