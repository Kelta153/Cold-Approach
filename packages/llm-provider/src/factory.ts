import type { LLMProvider } from './types';
import { GroqProvider } from './groq-provider';
import { HaikuProvider } from './haiku-provider';

/** No other code should care which implementation is active — call this factory and use
 * whatever it returns. Controlled entirely by `LLM_PROVIDER` ("groq" | "haiku"), default "groq".
 * Same on/off pattern as @outreach-engine/enrichment's `createEnrichmentAdapters()`. */
export function getLLMProvider(env: { LLM_PROVIDER?: string } = process.env): LLMProvider {
  if (env.LLM_PROVIDER === 'haiku') return new HaikuProvider();
  return new GroqProvider();
}
