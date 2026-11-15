import {NextResponse} from 'next/server';
import {
  SESSION_HEARTBEAT_VERSION,
  heartbeatAllowsWork,
  parseSessionHeartbeat,
} from '../../../../lib/session-heartbeat';
import {listRecentHeartbeats, rememberHeartbeat} from '../../../../lib/session-heartbeat-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const recent = listRecentHeartbeats();
  return NextResponse.json({
    ok: true,
    contractVersion: SESSION_HEARTBEAT_VERSION,
    liveCycleEnabled: false,
    activeSessions: recent.filter((row) => row.allowsWork).length,
    recent,
    note: 'Ephemeral in-memory beats for contract checks. They do not start autonomous improvement (P3 not enabled).',
  });
}

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ok: false, error: 'invalid_json'}, {status: 400});
  }
  const beat = parseSessionHeartbeat(body);
  if (!beat) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_or_inactive_heartbeat',
        contractVersion: SESSION_HEARTBEAT_VERSION,
        note: 'Requires visible=true, liveWorkEnabled=true and a valid session payload.',
      },
      {status: 400},
    );
  }
  rememberHeartbeat(beat);
  const allows = heartbeatAllowsWork(beat);
  return NextResponse.json({
    ok: true,
    accepted: true,
    allowsWork: allows,
    liveCycleEnabled: false,
    contractVersion: SESSION_HEARTBEAT_VERSION,
    sessionId: beat.sessionId,
    room: beat.room ?? null,
    activeSessions: listRecentHeartbeats().filter((row) => row.allowsWork).length,
    note: 'Beat recorded for contract checks only. No task was claimed or started.',
  });
}
