import { MultiSourceVerifier } from './multiSourceVerifier';
import { EvidenceItem } from '../types';

export async function fetchAllEvidence(query: string): Promise<EvidenceItem[]> {
  const verifier = new MultiSourceVerifier();
  const results = await verifier.verifyWithMultipleSources(query);

  // Flatten the results from all sources into a single array of evidence items
  const allEvidence = results.flatMap(result => result.results || []);

  // The AdvancedEvidence from the verifier is compatible with EvidenceItem
  return allEvidence as EvidenceItem[];
}
