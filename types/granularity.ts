export interface Entity {
  text: string;
  type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'DATE' | 'EVENT';
}

export interface AtomicStatement {
  statement: string;
  entities: Entity[];
}

export interface GranularityAnalysisResult {
  atomicStatements: AtomicStatement[];
}
