import { FactCheckReport } from '../types/factCheck';
import { ContentPlan, FAQQuestion } from '../types/seoAnalysis';

export class SchemaGenerator {
  private static instance: SchemaGenerator;

  static getInstance(): SchemaGenerator {
    if (!SchemaGenerator.instance) {
      SchemaGenerator.instance = new SchemaGenerator();
    }
    return SchemaGenerator.instance;
  }

  generateClaimReviewSchema(report: FactCheckReport): string {
    const schema = {
      "@context": "https://schema.org",
      "@type": "ClaimReview",
      "url": window.location.href,
      "claimReviewed": report.originalText,
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": report.final_score,
        "bestRating": 100,
        "worstRating": 0,
        "alternateName": report.final_verdict
      },
      "itemReviewed": {
        "@type": "Claim",
        "text": report.originalText,
        "author": {
          "@type": "Organization",
          "name": "Unknown"
        }
      },
      "author": {
        "@type": "Organization",
        "name": "Jules AI",
        "url": "https://julesai.com"
      },
      "datePublished": new Date().toISOString(),
      "publisher": {
        "@type": "Organization",
        "name": "Jules AI",
        "logo": {
          "@type": "ImageObject",
          "url": "https://julesai.com/logo.png"
        }
      }
    };

    return JSON.stringify(schema, null, 2);
  }

  generateArticleSchema(contentPlan: ContentPlan, content: string): string {
    const wordCount = content.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    const schema = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": contentPlan.outline.title,
      "description": contentPlan.outline.metaDescription,
      "image": "https://julesai.com/default-article-image.jpg",
      "author": {
        "@type": "Person",
        "name": "Jules AI Content Creator"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Jules AI",
        "logo": {
          "@type": "ImageObject",
          "url": "https://julesai.com/logo.png"
        }
      },
      "datePublished": new Date().toISOString(),
      "dateModified": new Date().toISOString(),
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": window.location.href
      },
      "wordCount": wordCount,
      "timeRequired": `PT${readingTime}M`,
      "keywords": contentPlan.targetKeywords.join(", "),
      "articleSection": contentPlan.topic,
      "about": {
        "@type": "Thing",
        "name": contentPlan.topic
      }
    };

    return JSON.stringify(schema, null, 2);
  }

  generateNewsArticleSchema(contentPlan: ContentPlan, content: string): string {
    const wordCount = content.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    const schema = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": window.location.href
      },
      "headline": contentPlan.outline.title,
      "image": [
        "https://julesai.com/news-article-image.jpg"
      ],
      "datePublished": new Date().toISOString(),
      "dateModified": new Date().toISOString(),
      "author": {
        "@type": "Person",
        "name": "Jules AI News Author"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Jules AI",
        "logo": {
          "@type": "ImageObject",
          "url": "https://julesai.com/logo-news.png"
        }
      },
      "description": contentPlan.outline.metaDescription,
      "wordCount": wordCount,
      "keywords": contentPlan.targetKeywords.join(", "),
      "articleSection": contentPlan.topic,
      "timeRequired": `PT${readingTime}M`
    };

    return JSON.stringify(schema, null, 2);
  }

  generateFAQSchema(faqQuestions: FAQQuestion[]): string {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqQuestions.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.suggestedAnswer
        }
      }))
    };

    return JSON.stringify(schema, null, 2);
  }

  generateBreadcrumbSchema(breadcrumbs: Array<{ name: string, url: string }>): string {
    const schema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": crumb.name,
        "item": crumb.url
      }))
    };

    return JSON.stringify(schema, null, 2);
  }

  generateWebsiteSchema(): string {
    const schema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Jules AI",
      "description": "Advanced AI-powered content enhancement and fact-checking platform",
      "url": "https://julesai.com",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://julesai.com/search?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Jules AI",
        "logo": {
          "@type": "ImageObject",
          "url": "https://julesai.com/logo.png"
        }
      }
    };

    return JSON.stringify(schema, null, 2);
  }

  generateOrganizationSchema(): string {
    const schema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Jules AI",
      "description": "Advanced AI-powered content enhancement and fact-checking platform for bloggers and journalists",
      "url": "https://julesai.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://julesai.com/logo.png",
        "width": 300,
        "height": 300
      },
      "foundingDate": "2024",
      "sameAs": [
        "https://twitter.com/julesai",
        "https://linkedin.com/company/julesai"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "Customer Service",
        "email": "support@julesai.com"
      }
    };

    return JSON.stringify(schema, null, 2);
  }
}
