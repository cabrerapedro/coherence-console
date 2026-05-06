export const HAIKU_4_5 = "anthropic/claude-haiku-4-5";
export const SONNET_4_6 = "anthropic/claude-sonnet-4-6";

const PRICES: Record<string, { input: number; output: number }> = {
  [HAIKU_4_5]: { input: 1, output: 5 },
  [SONNET_4_6]: { input: 3, output: 15 },
};

export type TokenUsage = {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
};

export function priceFor(model: string, usage: TokenUsage): number {
  const rates = PRICES[model];
  if (!rates) throw new Error(`No price configured for model: ${model}`);
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  return (input * rates.input + output * rates.output) / 1_000_000;
}
