// src/services/analysis/index.ts

// Core Analysis Services
export { 
    AdvancedTextAnalyzer,
    type NamedEntity,
    type AtomicClaim,
    type TemporalContext,
    type BiasIndicators,
    type DeepTextAnalysis
} from './AdvancedTextAnalyzer';

export {
    SemanticKeywordExtractor,
    type SemanticKeyword,
    type ConceptCluster,
    type DomainTerminology,
    type SemanticExtraction
} from './SemanticKeywordExtractor';

export {
    IntelligentQuerySynthesizer,
    type FactCheckQuery,
    type SearchOperator,
    type TemporalQuery,
    type QuerySynthesisResult
} from './IntelligentQuerySynthesizer';

// Citation Service (if it exists)
export { CitationAugmentedService } from './CitationAugmentedService';

// Advanced Pipeline (if it exists - export conditionally)
// Uncomment these when AdvancedQueryPipeline.ts is created
// export {
//     AdvancedQueryPipeline,
//     type PipelineResult,
//     type RankedQuery
// } from './AdvancedQueryPipeline';

// export {
//     PipelineIntegration,
//     type EnhancedSearchResult
// } from './PipelineIntegration';
