import {NextResponse} from 'next/server';
import {bridgeAuthorized, cloudError} from '@/lib/cloud/http';
import {
  EVIDENCE_CONTRACT_VERSION,
  parseEvidenceRecord,
} from '../../../../lib/evidence-contract';
import {listEvidence, rememberEvidence} from '../../../../lib/evidence-store';

export const dynamic = 'force-dynamic';

/** Public read: absence means unknown, not success. */
export async function GET() {
  const evidence = listEvidence();
  return NextResponse.json({
    ok: true,
    contractVersion: EVIDENCE_CONTRACT_VERSION,
    evidence,
    count: evidence.length,
    note:
      evidence.length === 0
        ? 'No typed evidence records are published yet. Absence means unknown, not success.'
        : 'Records published by the bridge/coordinator. Passed alone does not mean integrated.',
  });
}

/** Bridge-only write. Unauthenticated clients remain forbidden. */
export async function POST(request: Request) {
  try {
    await bridgeAuthorized(request);
  } catch (error) {
    let body: unknown = null;
    try {
      body = await request.clone().json();
    } catch {
      /* ignore */
    }
    const parsed = parseEvidenceRecord(body);
    if (error && typeof error === 'object') {
      return cloudError(error);
    }
    return NextResponse.json(
      {
        ok: false,
        error: 'evidence_write_forbidden',
        acceptedShape: parsed !== null,
        contractVersion: EVIDENCE_CONTRACT_VERSION,
        note: 'Evidence must come from the coordinator after external tests. UI cannot create verification.',
      },
      {status: 403},
    );
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ok: false, error: 'invalid_json'}, {status: 400});
  }

  const recordsIn = Array.isArray(body)
    ? body
    : body && typeof body === 'object' && Array.isArray((body as {records?: unknown}).records)
      ? (body as {records: unknown[]}).records
      : [body];

  const accepted: NonNullable<ReturnType<typeof parseEvidenceRecord>>[] = [];
  for (const item of recordsIn.slice(0, 16)) {
    const parsed = parseEvidenceRecord(item);
    if (parsed) {
      rememberEvidence(parsed);
      accepted.push(parsed);
    }
  }

  if (accepted.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_evidence_shape',
        contractVersion: EVIDENCE_CONTRACT_VERSION,
        note: 'No record matched EvidenceRecord v1.',
      },
      {status: 400},
    );
  }

  return NextResponse.json({
    ok: true,
    accepted: accepted.length,
    contractVersion: EVIDENCE_CONTRACT_VERSION,
    evidence: listEvidence(),
    note: 'Ephemeral store updated. Integration claims still require integratedRevision.',
  });
}
