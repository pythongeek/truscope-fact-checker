// src/api-lib/news-search.ts - OPTIMIZED VERSION FOR TOKEN ECONOMY
import { VercelRequest, VercelResponse } from '@vercel/node';

// --- CONFIGURATION CONSTANTS ---
const NEWS_API_BASE_URL = 'https://newsdata.io/api/1/news';

// Token Economy Settings (Based on NewsData.io pricing)
// Recent content (last 30 days) = 1 token per search
// Older content = higher token cost
const DEFAULT_PAGE_SIZE = 10; // Reduced from 20 for faster responses
const MAX_PAGE_SIZE = 50; // Hard limit to prevent token waste
const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

// Cache settings (in-memory cache for this serverless instance)
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache
const cache = new Map<string, { data: any; timestamp: number }>();

// Rate limiting (simple in-memory counter)
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // Max 10 requests per minute per IP

/**
 * Get date for 30 days ago in YYYY-MM-DD format
 */
const getThirtyDaysAgoDate = (): string => {
  const date = new Date(Date.now() - THIRTY_DAYS_IN_MS);
  return date.toISOString().split('T')[0];
};

/**
 * Generate a cache key from search parameters
 */
const generateCacheKey = (query: string, fromDate: string, pageSize: number): string => {
  return `news:${query}:${fromDate}:${pageSize}`.toLowerCase().replace(/\s+/g, '_');
};

/**
 * Check if cached data is still valid
 */
const getCachedData = (cacheKey: string): any | null => {
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[news-search] ✅ Cache HIT for key: ${cacheKey}`);
    return cached.data;
  }
  
  if (cached) {
    cache.delete(cacheKey); // Remove stale cache
    console.log(`[news-search] 🗑️ Stale cache removed for key: ${cacheKey}`);
  }
  
  return null;
};

/**
 * Store data in cache
 */
const setCachedData = (cacheKey: string, data: any): void => {
  cache.set(cacheKey, { data, timestamp: Date.now() });
  console.log(`[news-search] 💾 Cached data for key: ${cacheKey}`);
};

/**
 * Simple rate limiting check
 */
const checkRateLimit = (identifier: string): boolean => {
  const now = Date.now();
  const userLimit = rateLimits.get(identifier);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or create new rate limit window
    rateLimits.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    console.warn(`[news-search] ⚠️ Rate limit exceeded for: ${identifier}`);
    return false;
  }

  userLimit.count++;
  return true;
};

/**
 * Optimize query for better relevance and token efficiency
 */
const optimizeQuery = (query: string): string => {
  // Remove extra whitespace
  let optimized = query.trim().replace(/\s+/g, ' ');
  
  // Truncate very long queries (NewsData.io has query length limits)
  if (optimized.length > 512) {
    console.warn(`[news-search] Query truncated from ${optimized.length} to 512 characters`);
    optimized = optimized.substring(0, 512);
  }
  
  // Remove special characters that might cause issues
  optimized = optimized.replace(/[^\w\s\-"]/g, '');
  
  return optimized;
};

/**
 * Clean cache periodically (prevents memory buildup)
 */
const cleanOldCache = (): void => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      cache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[news-search] 🧹 Cleaned ${cleaned} stale cache entries`);
  }
};

/**
 * Main Vercel Serverless Function Handler
 * Optimized for token economy with NewsData.io API
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  try {
    console.log('[news-search] 🚀 Function invoked');

    // Periodic cache cleanup
    if (Math.random() < 0.1) { // 10% chance per request
      cleanOldCache();
    }

    // --- Rate Limiting ---
    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    const rateLimitKey = Array.isArray(clientIp) ? clientIp[0] : clientIp;
    
    if (!checkRateLimit(rateLimitKey as string)) {
      return res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: 'Too many requests. Please wait a moment before trying again.',
        retryAfter: 60,
      });
    }

    // --- Input Validation ---
    const { query, fromDate, pageSize, language } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      console.error('[news-search] ❌ Invalid query parameter');
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing or invalid "query" parameter.',
      });
    }

    // --- API Key Validation ---
    const apiKey = process.env.NEWSAPI_API_KEY;
    if (!apiKey) {
      console.error('[news-search] ❌ FATAL: NEWSAPI_API_KEY not configured!');
      return res.status(500).json({
        error: 'Server Configuration Error',
        message: 'News API key not configured. Please contact administrator.',
      });
    }

    // --- Optimize Query ---
    const optimizedQuery = optimizeQuery(query);
    console.log(`[news-search] 📝 Optimized query: "${optimizedQuery}"`);

    // --- Token-Saving Strategy: Default to Recent Content (1 token) ---
    const searchFromDate = fromDate
      ? new Date(fromDate).toISOString().split('T')[0]
      : getThirtyDaysAgoDate();

    // Validate page size
    const validatedPageSize = Math.min(
      Math.max(1, parseInt(pageSize?.toString() || DEFAULT_PAGE_SIZE.toString(), 10)),
      MAX_PAGE_SIZE
    );

    // --- Check Cache First ---
    const cacheKey = generateCacheKey(optimizedQuery, searchFromDate, validatedPageSize);
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      const responseTime = Date.now() - startTime;
      console.log(`[news-search] ⚡ Returning cached data (${responseTime}ms) - ZERO TOKENS USED`);
      return res.status(200).json({
        ...cachedData,
        _meta: {
          cached: true,
          responseTime: `${responseTime}ms`,
          tokensUsed: 0,
        },
      });
    }

    // --- API Parameter Construction ---
    const params = new URLSearchParams({
      apikey: apiKey,
      q: optimizedQuery,
      size: validatedPageSize.toString(),
      language: language || 'en',
      from_date: searchFromDate,
      // Additional optimization: prioritize high-quality sources
      prioritydomain: 'top', // NewsData.io parameter for premium sources
    });

    console.log(`[news-search] 🔍 Searching from: ${searchFromDate} (Recent = 1 token)`);
    console.log(`[news-search] 📊 Page size: ${validatedPageSize}`);

    // --- API Call ---
    const apiUrl = `${NEWS_API_BASE_URL}?${params.toString()}`;
    console.log(`[news-search] 📡 Calling News API...`);

    const apiResponse = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'TruScope-FactChecker/1.0',
      },
    });

    const responseTime = Date.now() - startTime;
    console.log(`[news-search] 📥 API Response: ${apiResponse.status} (${responseTime}ms)`);

    // --- Error Handling ---
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`[news-search] ❌ API Error ${apiResponse.status}:`, errorText);

      // Parse error message if JSON
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = { message: errorText };
      }

      return res.status(apiResponse.status).json({
        error: 'News API Error',
        message: errorDetails.message || 'Failed to fetch news data',
        details: errorDetails,
        status: apiResponse.status,
      });
    }

    // --- Success Response ---
    const data = await apiResponse.json();

    // Check if API returned an error in the response body
    if (data.status === 'error') {
      console.error('[news-search] ❌ API returned error:', data.results?.message);
      return res.status(400).json({
        error: 'News API Error',
        message: data.results?.message || 'Unknown API error',
        code: data.results?.code,
      });
    }

    // Add metadata about the request
    const enrichedData = {
      ...data,
      _meta: {
        cached: false,
        responseTime: `${responseTime}ms`,
        tokensUsed: 1, // Recent content = 1 token
        queryOptimized: optimizedQuery !== query,
        resultsCount: data.results?.length || 0,
        searchWindow: {
          from: searchFromDate,
          to: new Date().toISOString().split('T')[0],
          daysSearched: Math.ceil((Date.now() - new Date(searchFromDate).getTime()) / (24 * 60 * 60 * 1000)),
        },
      },
    };

    // --- Cache the Result ---
    setCachedData(cacheKey, enrichedData);

    console.log(`[news-search] ✅ Success - ${enrichedData._meta.resultsCount} articles found (${responseTime}ms)`);
    console.log(`[news-search] 💰 Tokens used: 1 (recent content search)`);

    return res.status(200).json(enrichedData);

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error('[news-search] ❌ Unexpected error:', error);
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'An unexpected error occurred',
      responseTime: `${responseTime}ms`,
    });
  }
}
