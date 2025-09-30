// src/services/evidenceNormalizer.ts

import { EvidenceItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Normalizes the response from SERP API into our standard EvidenceItem format.
 * @param apiResponse - The raw JSON response from the SERP API.
 * @returns An array of EvidenceItem objects.
 */
export function normalizeSerpResponse(apiResponse: any): EvidenceItem[] {
  if (!apiResponse?.organic_results) {
    return [];
  }

  return apiResponse.organic_results.map((result: any): EvidenceItem => {
    return {
      id: uuidv4(),
      source_name: result.source || result.displayed_link,
      source_url: result.link,
      published_at: result.date ? new Date(result.date).toISOString() : null,
      title: result.title,
      snippet: result.snippet || 'No snippet available.',
      confidence_score: 0.7, // Default confidence, to be refined by validator
      retrieved_at: new Date().toISOString(),
      metadata: {
        author: null,
        domain_authority: null,
        api_source: 'serp',
      },
    };
  });
}

/**
 * Normalizes the response from NewsData.io API into our standard EvidenceItem format.
 * @param apiResponse - The raw JSON response from the NewsData.io API.
 * @returns An array of EvidenceItem objects.
 */
export function normalizeNewsDataResponse(apiResponse: any): EvidenceItem[] {
  if (!apiResponse?.results) {
    return [];
  }

  return apiResponse.results.map((article: any): EvidenceItem => {
    return {
      id: uuidv4(),
      source_name: article.source_id || 'Unknown Source',
      source_url: article.link,
      published_at: article.pubDate ? new Date(article.pubDate).toISOString() : null,
      title: article.title,
      snippet: article.description || article.content || 'No snippet available.',
      confidence_score: 0.75, // Default confidence, slightly higher for news sources
      retrieved_at: new Date().toISOString(),
      metadata: {
        author: article.creator ? article.creator.join(', ') : null,
        domain_authority: null,
        api_source: 'newsdata',
      },
    };
  });
}
