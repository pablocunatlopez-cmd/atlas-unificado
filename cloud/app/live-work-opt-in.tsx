'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {SESSION_HEARTBEAT_VERSION} from '../lib/session-heartbeat';

const STORAGE_KEY = 'atlas.liveWorkOptIn';
const SESSION_KEY = 'atlas.liveWorkSessionId';
const BEAT_MS = 15000;
const REQUEST_MS = 8000;

function readOptIn(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeOptIn(value: boolean) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, '1');
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing;
    const id = `sess_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `sess_${Date.now().toString(36)}`;
  }
}

type Props = {
  room?: string;
  /** When false, beats are skipped even if opted in. */
  bridgeOnline?: boolean;
};

export default function LiveWorkOptIn({room, bridgeOnline = true}: Props) {
  const [enabled, setEnabled] = useState(false);
  const [lastOk, setLastOk] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    setEnabled(readOptIn());
  }, []);

  const sendBeat = useCallback(async (signal?: AbortSignal) => {
    if (!enabled || document.hidden || !bridgeOnline || busy.current) return;
    busy.current = true;
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), REQUEST_MS);
    const combined = signal
      ? AbortSignal.any([signal, timeout.signal])
      : timeout.signal;
    try {
      const response = await fetch('/api/cloud/session-heartbeat', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        cache: 'no-store',
        credentials: 'same-origin',
        signal: combined,
        body: JSON.stringify({
          contractVersion: SESSION_HEARTBEAT_VERSION,
          sessionId: sessionId(),
          at: new Date().toISOString(),
          visible: !document.hidden,
          liveWorkEnabled: true,
          room: room && /^[a-z0-9_-]{1,40}$/.test(room) ? room : undefined,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        liveCycleEnabled?: boolean;
        note?: string;
      } | null;
      if (!response.ok || !data?.ok) {
        setLastError(data?.note || 'Latido rechazado');
        setLastOk(null);
        return;
      }
      setLastError(null);
      setLastOk(
        data.liveCycleEnabled
          ? 'Ciclo en vivo activo'
          : 'Opt-in registrado · ciclo aún no activado en servidor',
      );
    } catch {
      if (!signal?.aborted) {
        setLastError('No se pudo enviar el latido');
        setLastOk(null);
      }
    } finally {
      clearTimeout(timer);
      busy.current = false;
    }
  }, [enabled, bridgeOnline, room]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void sendBeat(controller.signal);
    const interval = setInterval(() => void sendBeat(controller.signal), BEAT_MS);
    const onVisibility = () => {
      if (!document.hidden) void sendBeat(controller.signal);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, sendBeat]);

  const toggle = () => {
    const next = !enabled;
    writeOptIn(next);
    setEnabled(next);
    if (!next) {
      setLastOk(null);
      setLastError(null);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 4,
        maxWidth: 220,
      }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        title={
          enabled
            ? 'Desactivar intención de trabajo en vivo (esta pestaña)'
            : 'Activar intención de trabajo en vivo solo mientras la pestaña esté visible'
        }
        style={{
          border: '1px solid ' + (enabled ? '#b9e48c66' : '#ffffff28'),
          background: enabled ? '#accd8518' : 'transparent',
          color: enabled ? '#d5f0b7' : '#c5d0c4',
          borderRadius: 20,
          padding: '6px 11px',
          fontSize: 10,
          letterSpacing: '0.04em',
          cursor: 'pointer',
        }}
      >
        {enabled ? 'Trabajo en vivo · on' : 'Trabajo en vivo · off'}
      </button>
      <span style={{fontSize: 9, lineHeight: 1.4, color: '#8a9a8c', textAlign: 'right'}}>
        {enabled
          ? lastError ||
            lastOk ||
            (bridgeOnline
              ? 'Latido solo con pestaña visible'
              : 'Sin puente · no se envían latidos')
          : 'No solicita ciclo al coordinador'}
      </span>
    </div>
  );
}
