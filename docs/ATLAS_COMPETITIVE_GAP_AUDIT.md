# Atlas competitive gap audit — 2026-11

This is an architecture comparison, **not** a benchmark of model quality or verified current leaderboard.

| Reference | Transferable engineering pattern | Atlas gap | Action |
|---|---|---|---|
| ChatGPT / Claude / Gemini | Strong foundation models, tool use, multimodal interaction | Atlas has no independently trained model with comparable measured performance | Route to available local models, benchmark honestly, never claim parity |
| Aider | Repository-aware editing and targeted context | Initial Atlas repo map followed only forward imports | Added reverse-dependency impact analysis |
| OpenHands | Controlled code execution and test feedback | Atlas cannot execute/test changes in an isolated sandbox | Build trusted executor and CI provenance; no false green statuses |
| Cursor / Cline | Iterative IDE workflow, code navigation, human oversight | Atlas has no full edit-run-diff-review loop | Build GitHub branch diff + bounded execution loop |
| Unreal / Unity | Real-time rendering, animation, asset pipelines, profilers | ERAS has a Three.js adapter and placeholder geometry only | Build asset pipeline, animation and performance instrumentation |
| Modern design systems | Accessible navigation, responsive components, clear status | Atlas dashboard is mostly static | Wire real navigation, accessible controls and actual data |

## Findings and concrete fixes
**P0 — incorrect context could lead to broken patches.** The previous cycle allowed missing update targets and conflicting create operations to reach review planning. The cycle now returns `resolve_missing_or_conflicting_files` and exposes `unresolved`.

**P1 — changes can break dependents.** A module edit may break importers, even when its own unit tests pass. The repo map now provides `selectAtlasAffectedModules` to enumerate reverse dependencies and prioritize regression tests.

**P0 — verified CI remains absent.** Existing gates still depend on an injected trusted verifier. No authentic test attestations or production auth.

**P0 — source parsing is heuristic.** Import regex can match comments or miss aliases; switch to a parser before making it a security-critical dependency.

**P1 — frontend is a concept, not a deployed app.** Visual code has not been rendered or integrated into Sites.

## Acceptance criteria for next iteration
1. Run all Node tests against the exact branch SHA.
2. Add AST-based repository parsing and dependency coverage tests.
3. Verify CI provenance and reviewer approval outside model control.
4. Add isolated patch execution with rollback and diff.
5. Integrate functional Atlas/ERAS navigation and live metrics.

No claim of outperforming commercial models, achieving AAA graphics, or production readiness is justified without reproducible evidence.
