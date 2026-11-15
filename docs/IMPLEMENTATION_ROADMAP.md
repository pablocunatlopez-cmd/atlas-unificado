# Implementation roadmap — Atlas / Lía

This file is the working plan for the unified repository. It is not a claim that live autonomous improvement is running.

## Priority order

### P0 — Baseline honesty
Ship surfaces that never invent online status, learning, or integrated improvement without coordinator-backed signals.

### P1 — Route and identity clarity
Canonical routes (`/`, `/chat/`, `/actividad/`), inventory, and character catalog without false “agent is working” claims.

### P2 — Truthful runtime visibility
1. Define a typed, versioned process event/status contract with task ID, owner scope, specialist ID, phase, timestamp, expiry, status, evidence/artefact reference, and bounded counters.
2. Fail closed on stale or missing telemetry (freshness window + hard request timeout).
3. Explicit reason codes for disconnected / stale / no process — UI must not invent activity.
4. Typed evidence for “improvement integrated” claims; absence = unknown.

### P3 — Session-bound improvement cycle
Only after P0–P2 pass:
- Opt-in + visible tab heartbeats
- Server `liveCycleEnabled` flag
- PC gate before autonomous review work
- Evidence records after real tests — never invent integration

## Acceptance rules

- Every accepted change has a source revision, artifact identity, test evidence, reviewer/authorization record and rollback target.
- If evidence is missing, display **unknown**, not success.

## Status notes

This roadmap is a plan. The Lía identity documents are in the repository, but the live job loop described in P3 is not enabled until operators set environment flags and publish Sites.

P2 has partial, verified progress as of 2026-11-15:

P2 progress (additional, 2026-11-15): the house status poll (`/api/cloud/status`) now has a hard 8-second timeout combined with the unmount AbortController (`AbortSignal.any`). A hung or slow response no longer leaves the UI in an ambiguous state; the badge flips to offline/failed and the process mirror fails closed under the existing 75 s freshness window. The tooltip distinguishes network/timeout/server failure from a clean “PC offline” signal. This closes the “hard request timeout” item of P2 for the house surface. Commit: 762e6d99ce20bed3913ba4c64cc0520db7038d35.

P2 progress (evidence skeleton, 2026-11-15): `cloud/lib/evidence-contract.ts` defines `EvidenceRecord` v1 and pure `parseEvidenceRecord` / `evidenceDisplayState`. `/api/cloud/evidence` GET returns an empty list with contractVersion; POST is forbidden so the browser cannot mint verification. Integration claims still require `integratedRevision` from the coordinator. Client telemetry reasons (`REASON_LABELS`, `telemetryFreshness`) are live in `process-state.js` / `residents.js`.

Memory progress (partial, 2026-11-15): manual personal notes now carry a closed scope (`global`, `resident:<id>`, `room:<id>`, `module:<id>`) and the general chat retrieves only `global` unless another scope is requested. Separately, the house records autonomous observations for the 18 workstations when `/api/cloud/status` receives fresh terminal telemetry: only `passed`/`failed`, deduplicated per 30-minute window, retained for 30 days and shown in the selected resident's card. The table is global and contains no user data; clients cannot write it. It is not learning, independent verification, personality or a background daemon. See [MEMORY_SCOPES.md](MEMORY_SCOPES.md).

Evolution charter progress (2026-11-15): `cloud/lib/lia-evolution.ts` defines Lía's purpose, non-harm priority, safety rules and capability map. The house shows it in a visible dialog, and `makeReply` answers purpose/evolution/body/3D-printing/3D-music questions with the same bounded statement. The map marks the 3D house as implemented; memory, glTF design, scene STL export and stereo music as partial; and a physical printed body, spatial music and an own general AI as research. The STL export writes millimetre ASCII triangles and a report that checks manifoldness, degenerate triangles, local solid thickness, overlaps and separate bodies; it does not validate materials, resistance or a slicer. No physical printer, print-validated body, spatial audio engine or general AI was added. See [LIA_EVOLUTION_CHARTER.md](LIA_EVOLUTION_CHARTER.md).

### Progress log — 2026-11-15 (evening)

**P2 evidence path (code complete, deploy pending):**
- `EvidenceRecord` v1 + store + `GET/POST /api/cloud/evidence` (POST bridge-token only).
- PC: `typed-evidence-from-report.mjs`, `publish-report-evidence.mjs`, `autonomous-review` attaches `typedEvidence`.
- Bridge tick syncs latest autonomy report to Sites once per `report.at`.
- `/actividad/` `TypedEvidencePanel` polls every 15 s; empty = unknown.

**P3 session-bound cycle (pipeline ready, flags off):**
- Heartbeat contract, API, opt-in UI (house + actividad), ephemeral store.
- `ATLAS_LIVE_CYCLE_ENABLED` server flag (default false).
- PC gate `session-live-work-gate.mjs`; optional `ATLAS_ENFORCE_SESSION_LIVE_WORK` on review jobs.
- See `continuous/SESSION_LIVE_WORK.md` and `continuous/TYPED_EVIDENCE_HOOK.md`.

**Still operator steps (not code):** publish Sites; set env flags only when intentionally enabling live cycle; restart local coordinator + bridge.
