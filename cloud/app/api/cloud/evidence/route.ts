import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {createEvidenceRepository} from '@/lib/evidence-repository';
import {NextResponse} from 'next/server';
import {bridgeAuthorized, cloudError} from '@/lib/cloud/http';
import {
  EVIDENCE_CONTRACT_VERSION,
  parseEvidenceRecord,
} from '../../../../lib/evidence-contract';
function repository(){if(!env.DB)throw Error('DB');return createEvidenceRepository(env.DB);}

export const dynamic = 'force-dynamic';

/** Public read: absence means unknown, not success. */
export async function GET() {
  let evidence;try{evidence=await repository().list();}catch(error){return cloudError(error);}
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
    const user=await getChatGPTUser();
    // Private Sites dispatch authorizes service requests; browser/legacy writes
    // retain bridge authentication and cannot invent verification from UI.
    if(user||request.headers.has('origin')||request.headers.has('sec-fetch-site')||!request.headers.has('x-dispatched-app'))await bridgeAuthorized(request);
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

  if(JSON.stringify(body).length>48000)return NextResponse.json({error:'Evidence payload too large'},{status:413});
  const recordsIn = Array.isArray(body)
    ? body
    : body && typeof body === 'object' && Array.isArray((body as {records?: unknown}).records)
      ? (body as {records: unknown[]}).records
      : [body];

  const accepted: NonNullable<ReturnType<typeof parseEvidenceRecord>>[] = [];
  for (const item of recordsIn.slice(0, 16)) {
    const parsed = parseEvidenceRecord(item);
    if (parsed) {
      await repository().remember(parsed);
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
    evidence: await repository().list(),
    note: 'Durable reports saved in D1. Integration claims still require integratedRevision; external checks are reported, not independently verified by this endpoint.',
  });
}
