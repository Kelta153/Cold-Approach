import { afterEach, describe, expect, it, vi } from 'vitest';
import { HunterFinder } from './hunter-finder';
import { HunterVerifier } from './hunter-verifier';
import { createEnrichmentAdapters } from './index';
import { WebsiteScraperFinder } from './website-scraper-finder';
import { MxRecordVerifier } from './mx-record-verifier';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HunterFinder', () => {
  it('calls the real Hunter domain-search endpoint and parses the highest-confidence email', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ data: { emails: [{ value: 'low@acme.com', confidence: 40 }, { value: 'best@acme.com', confidence: 92 }] } }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const finder = new HunterFinder('test-key');
    const result = await finder.findEmail({ name: 'Acme', website: 'https://acme.com' });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('api.hunter.io/v2/domain-search'));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('domain=acme.com'));
    expect(result.email).toBe('best@acme.com');
  });

  it('returns no result without throwing when HUNTER_API_KEY is unset', async () => {
    const finder = new HunterFinder('');
    const result = await finder.findEmail({ name: 'Acme', website: 'https://acme.com' });
    expect(result.email).toBeNull();
  });
});

describe('HunterVerifier', () => {
  it('calls the real Hunter email-verifier endpoint and maps its status', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { status: 'valid' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const verifier = new HunterVerifier('test-key');
    const result = await verifier.verify('best@acme.com');

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('api.hunter.io/v2/email-verifier'));
    expect(result.status).toBe('valid');
  });
});

describe('createEnrichmentAdapters', () => {
  it('defaults to the free WebsiteScraperFinder/MxRecordVerifier pair', () => {
    const adapters = createEnrichmentAdapters({});
    expect(adapters.finder).toBeInstanceOf(WebsiteScraperFinder);
    expect(adapters.verifier).toBeInstanceOf(MxRecordVerifier);
  });

  it('wraps Hunter in as a fallback only when ENRICHMENT_FALLBACK=hunter', () => {
    const adapters = createEnrichmentAdapters({ ENRICHMENT_FALLBACK: 'hunter' });
    expect(adapters.finder).not.toBeInstanceOf(WebsiteScraperFinder);
    expect(adapters.verifier).not.toBeInstanceOf(MxRecordVerifier);
  });
});
