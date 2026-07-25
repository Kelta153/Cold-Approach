import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroqProvider } from './groq-provider';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GroqProvider', () => {
  it('throws clearly when GROQ_API_KEY is not configured', () => {
    expect(() => new GroqProvider('')).toThrow(/GROQ_API_KEY/);
  });

  it('calls the real Groq chat completions endpoint and parses the JSON draft', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'chatcmpl-1',
          choices: [
            {
              message: {
                content: JSON.stringify({ subject: 'Hi there', body: 'Real body copy.', openPlaceholders: ['recipient name'] }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GroqProvider('test-key');
    const result = await provider.generateDraft({ prompt: 'Write a cold email.' });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('api.groq.com'), expect.anything());
    expect(result).toEqual({ subject: 'Hi there', body: 'Real body copy.', openPlaceholders: ['recipient name'] });
  });

  it('throws when the completion has no content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ id: 'chatcmpl-1', choices: [{ message: { content: null } }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const provider = new GroqProvider('test-key');
    await expect(provider.generateDraft({ prompt: 'x' })).rejects.toThrow(/no completion content/);
  });

  it('throws when the completion JSON has no body field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ id: 'chatcmpl-1', choices: [{ message: { content: JSON.stringify({ subject: 'x' }) } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const provider = new GroqProvider('test-key');
    await expect(provider.generateDraft({ prompt: 'x' })).rejects.toThrow(/"body"/);
  });
});
