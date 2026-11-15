# Atlas Unificado — Master Roadmap (2026-11-15)

## North star
Atlas is a measurable, self-improving, low-cost agent with ERAS as its integrated visual/world engine. Never confuse a planned capability with a verified one. No autonomous merge or publish without explicit owner approval.

## Milestone 0 — establish reality and test baseline (P0)
- [x] Inventory existing planning, scene, renderer, and evidence modules.
- [x] Confirm package scripts and CI trigger; inspected GitHub Actions on a pinned SHA (syntax passed; 802 tests: 791 passed, 1 failed, 1 cancelled, 9 skipped).
- [x] Correct identified Three.js parent attachment failure and non-cooperative workflow timeout cancellation.
- [ ] Re-run full suite on latest exact SHA and verify all required checks pass.
- [ ] Fix failing tests; publish reproducible test report.
**Done when:** clean install and CI test run pass with linked commit SHA.

## Milestone 1 — correct the agent safety boundaries (P0)
- [x] Reject unsafe patch paths and oversized changes.
- [x] Block missing update targets and conflicting create targets.
- [x] Identify reverse dependencies for regression impact.
- [x] Introduce injected trusted evidence verification interface.
- [x] Stop the legacy coding-cycle planner from treating caller-supplied check/approval flags as verified permission.
- [ ] Implement canonical-path/symlink checks in a trusted host.
- [ ] Bind approvals, checks, diff digest and commit SHA to an authenticated principal.
- [x] Define a fail-closed, bounded isolated-run contract and regression tests (planning only).
- [ ] Implement actual trusted sandbox execution, OS-enforced isolation and resource limits.
**Done when:** an adversarial patch cannot escape a sandbox and no unverified check can authorize publishing.

## Milestone 2 — working coding agent (P0)
- [x] Build repository context map, patch planner and coding-cycle orchestration.
- [ ] Replace regex imports with AST parser; add symbol/reverse-call indexing.
- [ ] Implement diff preview, Git branch CAS, rollback, and explicit human approval.
- [ ] Add iterative test/fix loop with finite attempts and stop conditions.
**Done when:** a task yields a reviewed PR with verifiable tests and rollback.

## Milestone 3 — memory and LOR-ΩΣ (P1)
- [ ] Persist owner-scoped memory with migrations, provenance and retention.
- [ ] Add negative-memory regression cases and reproducible benchmark sets.
- [ ] Compare A/B candidates with cost, latency, correctness and regression metrics.
- [ ] Route among free/local models when available; do not claim independent frontier-model parity.
**Done when:** Atlas can demonstrate improved scores on held-out tasks without regressions.

## Milestone 4 — Atlas Sites UX (P1)
- [x] Create responsive dark command center visual prototype.
- [ ] Implement real navigation, chat, agents, tasks, and evaluations views.
- [ ] Add loading/empty/error states, keyboard accessibility, i18n, mobile QA.
- [ ] Connect to trusted live backend and deploy via authorized Sites editor.
**Done when:** a real Sites session shows the dashboard and its controls work.

## Milestone 5 — ERAS integrated graphics (P1)
- [x] Procedural scene manifest, scene editor, renderer adapter and Three.js viewport prototype.
- [ ] Load verified glTF assets and animations; implement asset lifecycle/disposal.
- [ ] Add physics, terrain streaming, input controls, character animation and profiling.
- [ ] Benchmark mobile GPU/frame time and implement adaptive quality.
**Done when:** a playable, instrumented 3D scene works in Atlas on desktop and mobile.

## Milestone 6 — product reliability (P1)
- [ ] Add integration/end-to-end tests, observability, crash recovery and backups.
- [ ] Add permissions, abuse limits, audit trails and dependency security review.
- [ ] Document setup for free/local runtime and optional remote access.
**Done when:** deployment is reproducible, recoverable and measurable.

## Milestone 7 — measured autonomous improvement (P2)
- [ ] Run bounded experiments from LOR-ΩΣ; capture failure cases.
- [ ] Propose candidate patches, verify CI, compare metrics and open draft PRs.
- [ ] Promote only after authenticated owner approval; retain rollback.
**Done when:** multiple successful improvement cycles are reproducible with human-reviewed evidence.

## Execution rules
1. Prefer fixes that reduce false claims, data loss, regressions and wasted context.
2. Work in a branch and draft PR; never merge/deploy without explicit approval.
3. Do not claim tests passed unless exact SHA results are available.
4. Each iteration should leave code, tests, or verified findings in GitHub.
5. Sites publishing needs an actual authorized Sites integration; GitHub alone cannot deploy there.
6. Prefer free/open-source components and measure resource use.
