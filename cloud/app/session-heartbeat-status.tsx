'use client';

import {useEffect, useState} from 'react';
import {SESSION_HEARTBEAT_VERSION} from '../lib/session-heartbeat';
import LiveWorkOptIn from './live-work-opt-in';

type Recent = {
  sessionId: string;
  at: string;
  room: string | null;
  allowsWork: boolean;
  ageMs: number;
};

type Snapshot =
  | {kind: 'loading'}
  | {kind: 'error'; label: string}
  | {
      kind: 'ok';
      liveCycleEnabled: boolean;
      activeSessions: number;
      recent: Recent[];
      note: string;
    };

const POLL_MS = 15000;
const REQUEST_MS = 8000;

export default function SessionHeartbeatStatus({bridgeOnline = true}: {bridgeOnline?: boolean}) {
  const [snap, setSnap] = useState<Snapshot>({kind: 'loading'});

  useEffect(() => {
    let alive = true;
    let controller: AbortController | null = null;

    async function poll() {
      if (document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), REQUEST_MS);
      try {
        const response = await fetch('/api/cloud/session-heartbeat', {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('http');
        const data = (await response.json()) as {
          liveCycleEnabled?: boolean;
          activeSessions?: number;
          recent?: Recent[];
          note?: string;
        };
        if (!alive) return;
        setSnap({
          kind: 'ok',
          liveCycleEnabled: data.liveCycleEnabled === true,
          activeSessions: typeof data.activeSessions === 'number' ? data.activeSessions : 0,
          recent: Array.isArray(data.recent) ? data.recent.slice(0, 8) : [],
          note: typeof data.note === 'string' ? data.note : '',
        });
      } catch {
        if (alive) setSnap({kind: 'error', label: 'No se pudo leer el estado de latidos'});
      } finally {
        clearTimeout(timeout);
      }
    }

    void poll();
    const interval = setInterval(() => void poll(), POLL_MS);
    const onVis = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      controller?.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <section
      aria-labelledby="heartbeat-heading"
      style={{
        marginTop: 28,
        padding: '20px 0',
        borderTop: '1px solid #ffffff12',
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start'}}>
        <div style={{flex: '1 1 280px'}}>
          <p style={{fontSize: 9, letterSpacing: '1.8px', color: '#8ca38f', margin: 0}}>05 / LATIDO DE SESIÓN</p>
          <h2 id="heartbeat-heading" style={{font: '28px/1.15 Georgia, serif', letterSpacing: '-0.6px', margin: '10px 0'}}>
            Intención de trabajo en vivo
          </h2>
          <p style={{fontSize: 13, lineHeight: 1.8, color: '#9cafa0', maxWidth: 520}}>
            El opt-in solo registra latidos mientras la pestaña está visible. El servidor sigue con el ciclo desactivado:
            no reclama tareas ni mejora Lía por sí solo (contrato v{SESSION_HEARTBEAT_VERSION}).
          </p>
        </div>
        <LiveWorkOptIn bridgeOnline={bridgeOnline} room="actividad" />
      </div>

      {snap.kind === 'loading' && (
        <p role="status" style={{fontSize: 12, color: '#a9b8aa'}}>
          Consultando latidos…
        </p>
      )}
      {snap.kind === 'error' && (
        <p role="status" style={{fontSize: 12, color: '#d1bd92'}}>
          {snap.label}
        </p>
      )}
      {snap.kind === 'ok' && (
        <div
          style={{
            marginTop: 14,
            padding: '16px 18px',
            border: '1px solid #ffffff1c',
            borderRadius: 12,
            background: '#13231b',
          }}
        >
          <strong style={{display: 'block', fontSize: 13, color: '#d5f0b7'}}>
            Ciclo en vivo: {snap.liveCycleEnabled ? 'activado' : 'desactivado'} · sesiones con latido fresco:{' '}
            {snap.activeSessions}
          </strong>
          <span style={{display: 'block', marginTop: 6, fontSize: 12, color: '#9cafa0'}}>{snap.note}</span>
          {snap.recent.length > 0 && (
            <ul style={{listStyle: 'none', padding: 0, margin: '12px 0 0', fontSize: 11, color: '#a9b8aa'}}>
              {snap.recent.map((row) => (
                <li key={row.sessionId} style={{marginBottom: 4}}>
                  {row.sessionId.slice(0, 18)}… · {row.room || 'sin sala'} · {Math.round(row.ageMs / 1000)} s ·{' '}
                  {row.allowsWork ? 'fresco' : 'caducado'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
