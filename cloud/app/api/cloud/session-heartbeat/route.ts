import {NextResponse} from 'next/server';
import {
  SESSION_HEARTBEAT_VERSION,
  heartbeatAllowsWork,
  parseSessionHeartbeat,
} from '../../../../lib/session-heartbeat';
import {listRecentHeartbeats, rememberHeartbeat} from '../../../../lib/session-heartbeat-store';
import {liveCycleNote, readLiveCycleFlag} from '../../../../lib/live-cycle-flag';

export const dynamic = 'force-dynamic';

function resolveLiveCycleEnabled(): boolean {
  try {
    // Cloudflare Workers / Sites may inject bindings on process.env or a global env.
    // Prefer process.env so local Next and CI behave the same.
    return readLiveCycleFlag(
      typeof process !== 'undefined' && process.env
        ? (process.env as Record<string, unknown>)
        : null,
    );
  } catch {
    return false;
  }
}

export async function GET() {
  const recent = listRecentHeartbeats();
  const liveCycleEnabled = resolveLiveCycleEnabled();
  return NextResponse.json({
    ok: true,
    contractVersion: SESSION_HEARTBEAT_VERSION,
    liveCycleEnabled,
    activeSessions: recent.filter((row) => row.allowsWork).length,
    recent,
    note: liveCycleNote(liveCycleEnabled),
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
  const liveCycleEnabled = resolveLiveCycleEnabled();
  return NextResponse.json({
    ok: true,
    accepted: true,
    allowsWork: allows,
    liveCycleEnabled,
    contractVersion: SESSION_HEARTBEAT_VERSION,
    sessionId: beat.sessionId,
    room: beat.room ?? null,
    activeSessions: listRecentHeartbeats().filter((row) => row.allowsWork).length,
    note: liveCycleNote(liveCycleEnabled),
  });
}
