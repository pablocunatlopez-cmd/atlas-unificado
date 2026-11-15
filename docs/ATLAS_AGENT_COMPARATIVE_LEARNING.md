# Atlas · Lessons from open-source coding agents (2026-11)

Atlas should learn architecture patterns rather than copying proprietary code or claiming other agents' capabilities.

| Reference | Public sources | Atlas implementation target |
| --- | --- | --- |
| OpenHands | https://github.com/OpenHands/OpenHands | isolated agent runtime, events, observable task state |
| Aider | https://github.com/Aider-AI/aider | repository maps, Git-native patches, lint/test and rollback |
| Cline | https://github.com/cline/cline | plan/act split, explicit approvals, tool permissions |
| OpenCode | https://github.com/anomalyco/opencode | provider-independent model router |
| Goose | https://github.com/block/goose | capability-scoped extensions and tool adapters |
| Gemini CLI | https://github.com/google-gemini/gemini-cli | terminal tool schemas, explicit user-visible actions |

## First implemented gate
`continuous/atlas-agent-change-gate.mjs` produces a deterministic review recommendation from declared actions, checks and an approval attestation.

This is **not an authorization system**. `approval.verifiedByHost` is an ordinary caller-supplied field and is forgeable unless a trusted host constructs it from a verified authenticated session. The output `readyForReview` does not authorize executing, publishing or merging anything.

## Mandatory acceptance conditions
1. Run tests in CI and attach test results to a particular commit SHA.
2. Bind approval to authenticated principal, proposal hash, allowed action scope and expiry at a trusted server boundary.
3. Use a real sandbox for command execution, resource limits and network restrictions.
4. Build repo-map indexing with changed-file dependency context and a retrieval budget.
5. Add benchmark suite: issue resolution, test pass, rollback success, cost, wall time and reproducibility.
6. Keep model providers interchangeable; local models are a deployment option, not a guarantee of performance.
7. Integrate with existing Atlas LOR-ΩΣ evaluation rather than creating a second critic.

## State
Implemented: pure proposal review gate and tests. Not implemented: sandbox, verified approval service, Git operations, agent execution, or external extension access. GitHub draft PR only; no Sites deployment verified.
