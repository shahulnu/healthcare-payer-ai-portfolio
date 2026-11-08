// Pieces every app's model integration shares.

export const MODEL = process.env.PA_MODEL ?? "claude-opus-5-5";

// Claude Opus 5.5 list price, USD per million tokens.
const PRICE_IN = 4;
const PRICE_OUT = 20;

/** The model (and its server-side fallback) declined the request. */
export class ModelDeclinedError extends Error {}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  estCostUsd: number;
}

export function usageFrom(u: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}): Usage {
  const inputTokens = u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  return {
    inputTokens,
    outputTokens: u.output_tokens,
    estCostUsd: (inputTokens * PRICE_IN + u.output_tokens * PRICE_OUT) / 1_000_000,
  };
}

export const addUsage = (a: Usage | undefined, b: Usage): Usage => ({
  inputTokens: (a?.inputTokens ?? 0) + b.inputTokens,
  outputTokens: (a?.outputTokens ?? 0) + b.outputTokens,
  estCostUsd: (a?.estCostUsd ?? 0) + b.estCostUsd,
});

const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** True when the quote appears verbatim (ignoring case and whitespace) in the source text. */
export function quoteFound(quote: string, source: string | undefined): boolean {
  const q = normalize(quote);
  return q.length > 0 && source !== undefined && normalize(source).includes(q);
}
