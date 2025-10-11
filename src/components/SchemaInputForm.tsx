// src/components/SchemaInputForm.tsx
import React, { useState } from 'react';
import { Link, FileText, Globe, CheckCircle, AlertCircle, Plus, X } from 'lucide-react';
import { FactCheckReport } from '@/types';

interface SchemaInputFormProps {
  factCheckResult?: FactCheckReport | null;
  onGenerate: (data: any) => void;
  onClose: () => void;
}

export default function SchemaInputForm({ factCheckResult, onGenerate, onClose }: SchemaInputFormProps) {
  const [schemaType, setSchemaType] = useState<'ClaimReview' | 'NewsArticle' | 'Article'>('ClaimReview');
  const [formData, setFormData] = useState({
    // ClaimReview fields
    claimReviewed: factCheckResult?.originalText || '',
    websiteUrl: 'https://your-site.com',
    websiteName: 'Your Publication',

    // Article/NewsArticle fields
    headline: '',
    description: '',
    articleBody: '',
    authorName: '',
    authorUrl: '',
    publisherName: 'Your Publication',
    publisherUrl: 'https://your-site.com',
    publisherLogo: '',
    datePublished: new Date().toISOString().split('T')[0],
    dateModified: new Date().toISOString().split('T')[0],
    image: '',
    keywords: [] as string[]
  });

  const [keywordInput, setKeywordInput] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    const schemaData: any = {
      type: schemaType,
      websiteUrl: formData.websiteUrl,
      websiteName: formData.websiteName
    };

    if (schemaType === 'ClaimReview') {
      schemaData.claimReviewed = formData.claimReviewed;
      schemaData.factCheckScore = factCheckResult?.overallAuthenticityScore || 0;
      schemaData.verdict = factCheckResult?.claimVerifications?.[0]?.status || 'UNVERIFIED';
      schemaData.evidence = factCheckResult?.evidence || [];
    } else {
      schemaData.articleData = {
        headline: formData.headline,
        description: formData.description,
        articleBody: formData.articleBody,
        datePublished: formData.datePublished,
        dateModified: formData.dateModified,
        author: {
          name: formData.authorName,
          url: formData.authorUrl || undefined
        },
        publisher: {
          name: formData.publisherName,
          url: formData.publisherUrl,
          logo: formData.publisherLogo || undefined
        },
        image: formData.image || undefined,
        keywords: formData.keywords.length > 0 ? formData.keywords : undefined
      };
    }

    onGenerate(schemaData);
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!formData.websiteUrl || !formData.websiteUrl.startsWith('http')) {
      errors.push('Valid website URL is required (must start with http:// or https://)');
    }

    if (!formData.websiteName.trim()) {
      errors.push('Website/Publication name is required');
    }

    if (schemaType === 'ClaimReview') {
      if (!formData.claimReviewed.trim()) {
        errors.push('Claim text is required for ClaimReview schema');
      }
    } else {
      if (!formData.headline.trim()) {
        errors.push('Headline is required');
      }
      if (!formData.description.trim()) {
        errors.push('Description is required');
      }
      if (!formData.articleBody.trim()) {
        errors.push('Article body is required');
      }
      if (!formData.authorName.trim()) {
        errors.push('Author name is required');
      }
      if (!formData.datePublished) {
        errors.push('Publication date is required');
      }
    }

    return errors;
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !formData.keywords.includes(keywordInput.trim())) {
      setFormData({
        ...formData,
        keywords: [...formData.keywords, keywordInput.trim()]
      });
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setFormData({
      ...formData,
      keywords: formData.keywords.filter(k => k !== keyword)
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Schema.org Markup Generator</h3>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Schema Type Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Schema Type</label>
              <div className="grid grid-cols-3 gap-3">
                {['ClaimReview', 'NewsArticle', 'Article'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSchemaType(type as any)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      schemaType === type
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-center mb-2">
                      {type === 'ClaimReview' && <CheckCircle className="w-6 h-6" />}
                      {type === 'NewsArticle' && <FileText className="w-6 h-6" />}
                      {type === 'Article' && <Globe className="w-6 h-6" />}
                    </div>
                    <p className="font-semibold text-sm">{type}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-red-900 mb-2">Please fix the following errors:</h4>
                    <ul className="text-sm text-red-700 space-y-1">
                      {validationErrors.map((error, idx) => (
                        <li key={idx}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Common Fields */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 flex items-center">
                <Globe className="w-5 h-5 mr-2" />
                Website Information
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Website URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={formData.websiteUrl}
                    onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                    placeholder="https://your-site.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Publication Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.websiteName}
                    onChange={(e) => setFormData({ ...formData, websiteName: e.target.value })}
                    placeholder="Your Publication"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* ClaimReview Specific Fields */}
            {schemaType === 'ClaimReview' && (
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Fact-Check Details
                </h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Claim Being Reviewed <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.claimReviewed}
                    onChange={(e) => setFormData({ ...formData, claimReviewed: e.target.value })}
                    placeholder="The claim you are fact-checking..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                {factCheckResult && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700 mb-2">
                      <strong>Fact-Check Results:</strong>
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-blue-600">Score:</span>
                        <span className="font-bold ml-2">{factCheckResult.overallAuthenticityScore}/100</span>
                      </div>
                      <div>
                        <span className="text-blue-600">Verdict:</span>
                        <span className="font-bold ml-2">{factCheckResult.claimVerifications?.[0]?.status || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-blue-600">Sources:</span>
                        <span className="font-bold ml-2">{factCheckResult.evidence?.length || 0}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Article/NewsArticle Specific Fields */}
            {(schemaType === 'NewsArticle' || schemaType === 'Article') && (
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Article Details
                </h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Headline <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.headline}
                    onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                    placeholder="Article headline"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the article"
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Article Body <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.articleBody}
                    onChange={(e) => setFormData({ ...formData, articleBody: e.target.value })}
                    placeholder="Full article text..."
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Author Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.authorName}
                      onChange={(e) => setFormData({ ...formData, authorName: e.target.value })}
                      placeholder="John Doe"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Author URL (optional)
                    </label>
                    <input
                      type="url"
                      value={formData.authorUrl}
                      onChange={(e) => setFormData({ ...formData, authorUrl: e.target.value })}
                      placeholder="https://your-site.com/author/john-doe"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Publisher Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.publisherName}
                      onChange={(e) => setFormData({ ...formData, publisherName: e.target.value })}
                      placeholder="Your Publication"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Publisher URL
                    </label>
                    <input
                      type="url"
                      value={formData.publisherUrl}
                      onChange={(e) => setFormData({ ...formData, publisherUrl: e.target.value })}
                      placeholder="https://your-site.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Publisher Logo URL (recommended)
                  </label>
                  <input
                    type="url"
                    value={formData.publisherLogo}
                    onChange={(e) => setFormData({ ...formData, publisherLogo: e.target.value })}
                    placeholder="https://your-site.com/logo.png"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Helps with search result appearance</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Publication Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.datePublished}
                      onChange={(e) => setFormData({ ...formData, datePublished: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Modified Date
                    </label>
                    <input
                      type="date"
                      value={formData.dateModified}
                      onChange={(e) => setFormData({ ...formData, dateModified: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Article Image URL (recommended)
                  </label>
                  <input
                    type="url"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    placeholder="https://your-site.com/article-image.jpg"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Improves visibility in search results</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Keywords (optional)
                  </label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                      placeholder="Add keyword"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={addKeyword}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm flex items-center space-x-2"
                      >
                        <span>{keyword}</span>
                        <button
                          type="button"
                          onClick={() => removeKeyword(keyword)}
                          className="text-gray-500 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg font-medium flex items-center space-x-2"
              >
                <Link className="w-4 h-4" />
                <span>Generate Schema</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
