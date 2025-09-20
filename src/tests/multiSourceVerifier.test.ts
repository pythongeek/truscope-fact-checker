import { describe, test, expect, beforeEach, vi } from 'vitest';
import { MultiSourceVerifier } from '../services/multiSourceVerifier';

// Mock the global fetch function
global.fetch = vi.fn();

const createFetchResponse = (data: any, ok = true) => {
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  return {
    ok,
    json: () => new Promise((resolve) => resolve(data)),
    text: () => new Promise((resolve) => resolve(text)),
  };
};

describe('MultiSourceVerifier', () => {
  let verifier: MultiSourceVerifier;

  beforeEach(() => {
    verifier = new MultiSourceVerifier();
    vi.resetAllMocks();
  });

  test('should query multiple sources and return available results', async () => {
    // Mock successful responses for Wikipedia and PubMed, failure for others
    (fetch as any)
      .mockResolvedValueOnce(createFetchResponse({ // Wikipedia
        extract: 'Wikipedia summary about climate change.',
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Climate_change' } }
      }))
      .mockResolvedValueOnce(createFetchResponse({ // PubMed Search
        esearchresult: { idlist: ['123'] }
      }))
      .mockResolvedValueOnce(createFetchResponse({ // PubMed Detail
        result: { '123': { title: 'PubMed article', pubdate: '2023-01-01' } }
      }))
      .mockResolvedValueOnce(createFetchResponse('Some XML response for ArXiv', true)) // ArXiv success
      .mockResolvedValueOnce(createFetchResponse({}, false)); // Google News fails

    // For simplicity, let's assume ArXiv parsing finds no entries in the mock response
    const results = await verifier.verifyWithMultipleSources('climate change');

    expect(results).toBeDefined();
    // Expecting Wikipedia, PubMed, and ArXiv to be processed.
    // Even if ArXiv finds no entries, the source call itself was successful.
    // The filter at the end is `result.available`, which is true if results > 0.
    // Let's adjust the ArXiv mock to return something parsable.

    vi.resetAllMocks(); // Reset for a cleaner test

    const arxivXml = `
      <feed>
        <entry>
          <id>http://arxiv.org/abs/1234.5678</id>
          <title>An ArXiv Title</title>
          <summary>A summary.</summary>
          <published>2023-01-01T00:00:00Z</published>
        </entry>
      </feed>
    `;

    (fetch as any)
      .mockResolvedValueOnce(createFetchResponse({ // Wikipedia
        extract: 'Wikipedia summary about climate change.',
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Climate_change' } }
      }))
      .mockResolvedValueOnce(createFetchResponse({ // PubMed Search
        esearchresult: { idlist: ['123'] }
      }))
      .mockResolvedValueOnce(createFetchResponse({ // PubMed Detail
        result: { '123': { title: 'PubMed article', pubdate: '2023-01-01' } }
      }))
      .mockResolvedValueOnce(createFetchResponse(arxivXml, true)) // ArXiv success
      .mockResolvedValueOnce(createFetchResponse({}, false)); // Google News fails

    const finalResults = await verifier.verifyWithMultipleSources('climate change');
    expect(finalResults.length).toBe(3);
    expect(finalResults.map(r => r.source)).toEqual(['wikipedia', 'pubmed', 'arxiv']);
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  test('should handle API failures gracefully', async () => {
    // Mock failed responses for all sources
    (fetch as any).mockResolvedValue(createFetchResponse({}, false));

    const results = await verifier.verifyWithMultipleSources('nonexistent topic xyz123');

    expect(results).toBeDefined();
    expect(results.length).toBe(0);
    // Wiki, PubMed Search, ArXiv, Google News all fail
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});
