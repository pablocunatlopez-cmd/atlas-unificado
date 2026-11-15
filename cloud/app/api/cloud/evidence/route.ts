import {NextResponse} from 'next/server';
import {EVIDENCE_CONTRACT_VERSION, parseEvidenceRecord} from '../../../lib/evidence-contract';

export const dynamic = 'force-dynamic';

/**
 * Skeleton endpoint for typed improvement evidence.
 * Until the coordinator publishes records, the list is empty and the UI must show unknown.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    contractVersion: EVIDENCE_CONTRACT_VERSION,
    evidence: [] as unknown[],
    note: 'No typed evidence records are published yet. Absence means unknown, not success.',
  });
}

/** Clients cannot write evidence. Only the coordinator/bridge may supply records later. */
export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ok: false, error: 'invalid_json'}, {status: 400});
  }
  // Validate shape for diagnostics, but never persist from the browser.
  const parsed = parseEvidenceRecord(body);
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
