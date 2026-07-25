import Groq from 'groq-sdk';
import type { DraftGenerationInput, DraftGenerationResult, LLMProvider } from './types';

const MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT =
  'Respond with a single JSON object and nothing else — no prose before or after it. ' +
  'Shape: {"subject": string, "body": string, "openPlaceholders": string[]}.';

/** Real Groq Chat Completions call (OpenAI-compatible API) — the active default drafting
 * provider while Anthropic billing isn't set up yet (see factory.ts). Not a placeholder; this is
 * a fully working adapter, same standard as `HunterFinder` in @outreach-engine/enrichment. */
export class GroqProvider implements LLMProvider {
  readonly model = MODEL;
  private readonly client: Groq;

  constructor(apiKey = process.env.GROQ_API_KEY ?? '') {
    if (!apiKey) throw new Error('GROQ_API_KEY is not set — cannot use the Groq drafting provider.');
    this.client = new Groq({ apiKey });
  }

  async generateDraft(input: DraftGenerationInput): Promise<DraftGenerationResult> {
    const completion = await this.client.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: input.prompt },
      ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) throw new Error('Groq returned no completion content.');

    const parsed = JSON.parse(text) as { subject?: string; body?: string; openPlaceholders?: string[] };
    if (!parsed.body) throw new Error('Groq completion JSON did not include a "body" field.');

    return { subject: parsed.subject ?? '', body: parsed.body, openPlaceholders: parsed.openPlaceholders ?? [] };
  }
}
