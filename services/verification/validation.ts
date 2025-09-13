import type { SearchStrategy, SourceCollection, CredibilityScore, SearchResult, SourceItem } from '../../types/verification';

/**
 * A simple type guard to check if a value is a non-array object.
 * @param obj - The value to check.
 * @returns {obj is Record<string, unknown>} True if the value is a plain object.
 */
function isObject(obj: any): obj is Record<string, unknown> {
    return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
}

/**
 * Type guard to check if an object conforms to the SearchStrategy interface.
 * @param {any} obj - The object to validate.
 * @returns {obj is SearchStrategy} True if the object is a valid SearchStrategy.
 */
export function isSearchStrategy(obj: any): obj is SearchStrategy {
    return (
        isObject(obj) &&
        typeof obj.search_type === 'string' &&
        Array.isArray(obj.queries) &&
        obj.queries.every(q => typeof q === 'string') &&
        Array.isArray(obj.target_sources) &&
        typeof obj.verification_angle === 'string'
    );
}

/**
 * Type guard to check if an object is an array of SearchStrategy objects.
 * @param {any} obj - The object to validate.
 * @returns {obj is SearchStrategy[]} True if the object is a valid array of SearchStrategy.
 */
export function isSearchStrategyArray(obj: any): obj is SearchStrategy[] {
    return Array.isArray(obj) && obj.every(isSearchStrategy);
}

/**
 * Type guard to check if an object conforms to the SourceItem interface.
 * @private
 * @param {any} obj - The object to validate.
 * @returns {obj is SourceItem} True if the object is a valid SourceItem.
 */
function isSourceItem(obj: any): obj is SourceItem {
    return (
        isObject(obj) &&
        typeof obj.source_name === 'string' &&
        typeof obj.access_url === 'string' &&
        typeof obj.credibility_score === 'number' &&
        typeof obj.publication_date === 'string' &&
        typeof obj.verification_strength === 'string' &&
        typeof obj.relevant_information === 'string'
    );
}

/**
 * Type guard to check if an object conforms to the SourceCollection interface.
 * @param {any} obj - The object to validate.
 * @returns {obj is SourceCollection} True if the object is a valid SourceCollection.
 */
export function isSourceCollection(obj: any): obj is SourceCollection {
    if (!isObject(obj)) return false;
    // Check that each property is an array of source items
    return Object.values(obj).every(value =>
        Array.isArray(value) && value.every(isSourceItem)
    );
}

/**
 * Type guard to check if an object conforms to the CredibilityScore interface.
 * @param {any} obj - The object to validate.
 * @returns {obj is CredibilityScore} True if the object is a valid CredibilityScore.
 */
export function isCredibilityScore(obj: any): obj is CredibilityScore {
    return (
        isObject(obj) &&
        typeof obj.overall_score === 'number' &&
        isObject(obj.component_scores) &&
        isObject(obj.reasoning) &&
        Array.isArray(obj.confidence_interval) &&
        obj.confidence_interval.length === 2
    );
}

/**
 * Type guard to check if an object conforms to the core properties of a synthesized SearchResult.
 * @param {any} obj - The object to validate.
 * @returns {obj is Pick<SearchResult, 'isVerified' | 'confidenceScore' | 'summary'>} True if the object is a valid partial SearchResult.
 */
export function isSynthesizedResult(obj: any): obj is Pick<SearchResult, 'isVerified' | 'confidenceScore' | 'summary'> {
    return (
        isObject(obj) &&
        (typeof obj.isVerified === 'boolean' || obj.isVerified === null) &&
        typeof obj.confidenceScore === 'number' &&
        typeof obj.summary === 'string'
    );
}
