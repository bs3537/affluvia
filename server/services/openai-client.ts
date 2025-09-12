import OpenAI from "openai";

// Centralized OpenAI client + helpers configured for reasoning
export function createOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const DEFAULT_REASONING_MODEL = process.env.OPENAI_REASONING_MODEL || "o4-mini";

/**
 * Calls the Responses API with reasoning effort set to "high" and expects JSON output.
 * Returns the parsed JSON object.
 */
export async function respondJsonHighReasoning(client: OpenAI, params: {
  system: string;
  user: string;
  maxTokens?: number;
}) {
  const { system, user, maxTokens = 1500 } = params;

  const response = await client.responses.create({
    model: DEFAULT_REASONING_MODEL,
    reasoning: { effort: "high" },
    input: [
      {
        role: "system",
        content: [{ type: "text", text: system }],
      },
      {
        role: "user",
        content: [{ type: "text", text: user }],
      },
    ],
    response_format: { type: "json_object" },
    max_output_tokens: maxTokens,
  } as any);

  // SDK provides output_text helper which contains the final string payload
  const text = (response as any).output_text as string;
  return JSON.parse(text);
}

