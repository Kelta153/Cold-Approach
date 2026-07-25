import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLLMProvider } from './factory';
import { GroqProvider } from './groq-provider';
import { HaikuProvider } from './haiku-provider';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getLLMProvider', () => {
  it('defaults to GroqProvider', () => {
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key');
    const provider = getLLMProvider({});
    expect(provider).toBeInstanceOf(GroqProvider);
  });

  it('returns HaikuProvider only when LLM_PROVIDER=haiku', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic-key');
    const provider = getLLMProvider({ LLM_PROVIDER: 'haiku' });
    expect(provider).toBeInstanceOf(HaikuProvider);
  });

  it('ignores unrecognized LLM_PROVIDER values and falls back to Groq', () => {
    vi.stubEnv('GROQ_API_KEY', 'test-groq-key');
    const provider = getLLMProvider({ LLM_PROVIDER: 'something-else' });
    expect(provider).toBeInstanceOf(GroqProvider);
  });
});
