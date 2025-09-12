import type { SearchStrategy, SourceCollection, CredibilityScore, SearchResult, SourceItem } from '../../types/verification';

// A simple helper to check if an object is a plain object
function isObject(obj: any): obj is Record<string, unknown> {
    return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
}

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

export function isSearchStrategyArray(obj: any): obj is SearchStrategy[] {
    return Array.isArray(obj) && obj.every(isSearchStrategy);
}

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

export function isSourceCollection(obj: any): obj is SourceCollection {
    if (!isObject(obj)) return false;
    // Check that each property is an array of source items
    return Object.values(obj).every(value =>
        Array.isArray(value) && value.every(isSourceItem)
    );
}

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

export function isSynthesizedResult(obj: any): obj is Pick<SearchResult, 'isVerified' | 'confidenceScore' | 'summary'> {
    return (
        isObject(obj) &&
        (typeof obj.isVerified === 'boolean' || obj.isVerified === null) &&
        typeof obj.confidenceScore === 'number' &&
        typeof obj.summary === 'string'
    );
}
