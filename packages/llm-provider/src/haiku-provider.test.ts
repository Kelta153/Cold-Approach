import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HaikuProvider } from './haiku-provider';

beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic-key');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('HaikuProvider', () => {
  it('calls the real Anthropic Messages API and parses the structured JSON draft', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: JSON.stringify({ subject: 'Hi there', body: 'Real body copy.', openPlaceholders: ['recipient name'] }) }],
          model: 'claude-haiku-4-5',
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new HaikuProvider();
    const result = await provider.generateDraft({ prompt: 'Write a cold email.' });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('api.anthropic.com'), expect.anything());
    expect(result).toEqual({ subject: 'Hi there', body: 'Real body copy.', openPlaceholders: ['recipient name'] });
  });

  it('throws when the response has no text content block', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [],
            model: 'claude-haiku-4-5',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 0 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const provider = new HaikuProvider();
    await expect(provider.generateDraft({ prompt: 'x' })).rejects.toThrow(/no text content/);
  });
});
