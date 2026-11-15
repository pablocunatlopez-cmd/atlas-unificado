import type {EvidenceRecord} from './evidence-contract';

const MAX = 32;
const byArtifact = new Map<string, EvidenceRecord>();

export function rememberEvidence(record: EvidenceRecord): void {
  byArtifact.set(record.artifactId, record);
  if (byArtifact.size <= MAX) return;
  const ordered = [...byArtifact.entries()].sort(
    (a, b) => Date.parse(a[1].completedAt) - Date.parse(b[1].completedAt),
  );
  for (const [id] of ordered.slice(0, byArtifact.size - MAX)) byArtifact.delete(id);
}

export function listEvidence(): EvidenceRecord[] {
  return [...byArtifact.values()].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
}

export function clearEvidenceStoreForTests(): void {
  byArtifact.clear();
}
