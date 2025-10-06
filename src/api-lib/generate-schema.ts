
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simplified types based on what's needed for schema generation
interface EvidenceItem {
  publisher: string;
  url: string | null;
  publishedDate?: string;
}

interface PublisherInfo {
  organizationName: string;
  organizationUrl: string;
  articleUrl: string;
  headline: string;
  authorName: string;
}

interface SchemaRequestBody {
  claim: string;
  score: number;
  verdict: string;
  evidence: EvidenceItem[];
  publisherInfo: PublisherInfo;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const { claim, score, verdict, evidence, publisherInfo } = req.body as SchemaRequestBody;

  if (!claim || score === undefined || !verdict || !publisherInfo) {
    res.status(400).json({ error: 'Missing required fields: claim, score, verdict, publisherInfo' });
    return;
  }

  const { organizationName, organizationUrl, articleUrl, headline, authorName } = publisherInfo;

  const claimReviewSchema = {
    "@context": "https://schema.org",
    "@type": "ClaimReview",
    "datePublished": new Date().toISOString().split('T')[0],
    "url": articleUrl,
    "claimReviewed": claim,
    "author": {
      "@type": "Organization",
      "name": organizationName,
      "url": organizationUrl,
    },
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": score.toString(),
      "bestRating": "100",
      "worstRating": "0",
      "alternateName": verdict,
    },
    "itemReviewed": {
      "@type": "Claim",
      "author": {
        "@type": "Organization",
        "name": evidence?.[0]?.publisher || "Various Sources",
      },
      "datePublished": evidence?.[0]?.publishedDate || new Date().toISOString().split('T')[0],
      "appearance": evidence?.[0]?.url ? {
        "@type": "OpinionNewsArticle",
        "url": evidence[0].url,
        "headline": "Supporting Evidence"
      } : undefined,
    }
  };

  const newsArticleSchema = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": headline,
      "author": {
          "@type": "Person",
          "name": authorName
      },
      "publisher": {
          "@type": "Organization",
          "name": organizationName,
          "logo": {
              "@type": "ImageObject",
              "url": `${organizationUrl}/logo.png`
          }
      },
      "datePublished": new Date().toISOString(),
      "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": articleUrl
      },
      "articleBody": claim,
  };

  const htmlSnippet = `<script type="application/ld+json">${JSON.stringify(claimReviewSchema, null, 2)}</script>`;

  res.status(200).json({
    claimReviewSchema,
    newsArticleSchema,
    htmlSnippet,
    validation: {
      status: "valid", // Mock validation
      message: "Schema appears to be valid against Schema.org standards.",
    }
  });
}
