import Anthropic from '@anthropic-ai/sdk';
import type { DraftGenerationInput, DraftGenerationResult, LLMProvider } from './types';

const MODEL = 'claude-haiku-4-5';

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    body: { type: 'string' },
    openPlaceholders: { type: 'array', items: { type: 'string' } },
  },
  required: ['subject', 'body', 'openPlaceholders'],
  additionalProperties: false,
} as const;

/** Real Anthropic Messages API call — the intended production drafting provider once billing is
 * configured on the account. Not active by default (LLM_PROVIDER=groq; see factory.ts), but this
 * is not a placeholder — a full structured-output request against the real API, same standard as
 * GroqProvider, ready to flip on with no other code changes once `ant`/Console billing is set. */
export class HaikuProvider implements LLMProvider {
  readonly model = MODEL;
  private readonly client = new Anthropic();

  async generateDraft(input: DraftGenerationInput): Promise<DraftGenerationResult> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { format: { type: 'json_schema', schema: DRAFT_SCHEMA } },
      messages: [{ role: 'user', content: input.prompt }],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    if (!textBlock) throw new Error('Haiku returned no text content.');

    return JSON.parse(textBlock.text) as DraftGenerationResult;
  }
}
