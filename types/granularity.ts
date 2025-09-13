/**
 * Represents a single Named Entity recognized within a text.
 */
export interface Entity {
  /**
   * The text of the entity as it appears in the source.
   */
  text: string;
  /**
   * The type of the named entity.
   */
  type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'DATE' | 'EVENT';
}

/**
 * Represents a single, simple, verifiable statement that has been broken down
 * from a more complex claim.
 */
export interface AtomicStatement {
  /**
   * The text of the atomic statement.
   */
  statement: string;
  /**
   * An array of named entities found within this atomic statement.
   */
  entities: Entity[];
}

/**
 * Represents the structured result of a granularity analysis, which breaks a
 * complex claim down into its atomic components.
 */
export interface GranularityAnalysisResult {
  /**
   * An array of atomic statements extracted from the original claim.
   */
  atomicStatements: AtomicStatement[];
}
