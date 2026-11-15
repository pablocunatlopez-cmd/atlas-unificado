'use client';

import {useEffect, useState} from 'react';
import {
  EVIDENCE_CONTRACT_VERSION,
  evidenceDisplayState,
  parseEvidenceRecord,
  type EvidenceRecord,
} from '../lib/evidence-contract';

type PanelState =
  | {kind: 'loading'}
  | {kind: 'error'; label: string}
  | {kind: 'empty'; label: string}
  | {
      kind: 'items';
      contractVersion: number;
      rows: {record: EvidenceRecord; label: string; mayClaimIntegrated: boolean}[];
    };

const REQUEST_MS = 8000;
const POLL_MS = 15000;

function readRows(data: {contractVersion?: number; evidence?: unknown[]}) {
  const version =
    data.contractVersion === EVIDENCE_CONTRACT_VERSION ? data.contractVersion : EVIDENCE_CONTRACT_VERSION;
  const raw = Array.isArray(data.evidence) ? data.evidence.slice(0, 32) : [];
  const rows = raw
    .map((item) => {
      const record = parseEvidenceRecord(item);
      if (!record) return null;
      const display = evidenceDisplayState(record);
      return {record, label: display.label, mayClaimIntegrated: display.mayClaimIntegrated};
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  return {version, rows};
}

export default function TypedEvidencePanel() {
  const [state, setState] = useState<PanelState>({kind: 'loading'});

  useEffect(() => {
    let alive = true;
    let controller: AbortController | null = null;

    async function poll() {
      if (document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      const timer = setTimeout(() => controller?.abort(), REQUEST_MS);
      try {
        const response = await fetch('/api/cloud/evidence', {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('http_' + response.status);
        const data = (await response.json()) as {contractVersion?: number; evidence?: unknown[]};
        if (!alive) return;
        const {version, rows} = readRows(data);
        if (rows.length === 0) {
          setState({kind: 'empty', label: 'Sin evidencia tipada'});
          return;
        }
        setState({kind: 'items', contractVersion: version, rows});
      } catch {
        if (!alive) return;
        if (controller?.signal.aborted && document.hidden) return;
        setState({
          kind: 'error',
          label: controller?.signal.aborted
            ? 'Sin evidencia tipada (tiempo de espera agotado)'
            : 'Sin evidencia tipada (no se pudo consultar el contrato)',
        });
      } finally {
        clearTimeout(timer);
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
      aria-labelledby="typed-evidence-heading"
      style={{
        marginTop: 28,
        padding: '20px 0',
        borderTop: '1px solid #ffffff12',
      }}
    >
      <p style={{fontSize: 9, letterSpacing: '1.8px', color: '#8ca38f', margin: 0}}>04 / CONTRATO DE EVIDENCIA</p>
      <h2 id="typed-evidence-heading" style={{font: '28px/1.15 Georgia, serif', letterSpacing: '-0.6px', margin: '10px 0'}}>
        Mejoras de Lía con prueba tipada
      </h2>
      <p style={{fontSize: 13, lineHeight: 1.8, color: '#9cafa0', maxWidth: 640}}>
        Solo el coordinador (vía puente) puede publicar registros. Lista vacía = <strong>desconocido</strong>, no éxito.
        Superar pruebas no equivale a integración sin una revisión citada. Actualización cada 15 s.
      </p>

      {state.kind === 'loading' && (
        <p role="status" style={{fontSize: 12, color: '#a9b8aa'}}>
          Consultando contrato v{EVIDENCE_CONTRACT_VERSION}…
        </p>
      )}

      {(state.kind === 'empty' || state.kind === 'error') && (
        <div
          role="status"
          style={{
            marginTop: 14,
            padding: '16px 18px',
            border: '1px solid #ffffff1c',
            borderRadius: 12,
            background: '#13231b',
          }}
        >
          <strong style={{display: 'block', fontSize: 14, color: '#d5f0b7'}}>{state.label}</strong>
          <span style={{display: 'block', marginTop: 6, fontSize: 12, color: '#9cafa0'}}>
            Contrato v{EVIDENCE_CONTRACT_VERSION}. Cuando el puente publique un registro válido aparecerá aquí.
          </span>
        </div>
      )}

      {state.kind === 'items' && (
        <ul style={{listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'grid', gap: 12}}>
          {state.rows.map(({record, label, mayClaimIntegrated}) => (
            <li
              key={record.taskId + ':' + record.artifactId + ':' + record.completedAt}
              style={{
                padding: '14px 16px',
                border: '1px solid #ffffff1c',
                borderRadius: 12,
                background: '#13231b',
              }}
            >
              <strong style={{fontSize: 13}}>{label}</strong>
              <span style={{display: 'block', marginTop: 6, fontSize: 11, color: '#9cafa0'}}>
                {record.verdict} · tarea {record.taskId} · proceso {record.processId} · artefacto {record.artifactId}
                {mayClaimIntegrated && record.integratedRevision
                  ? ` · integración ${record.integratedRevision}`
                  : ' · sin integración citada'}
              </span>
              {record.criteria?.length > 0 && (
                <span style={{display: 'block', marginTop: 4, fontSize: 11, color: '#8ca38f'}}>
                  {record.criteria.slice(0, 2).join(' · ')}
                </span>
              )}
              {record.reason && (
                <span style={{display: 'block', marginTop: 4, fontSize: 11, color: '#a9b8aa'}}>{record.reason}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
