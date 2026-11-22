# Atlas · Sites-first architecture

## Deployment target
The current user-facing Atlas runs in ChatGPT Sites. The RTX 3060/Ollama integration is optional future work, not a dependency.

## Portable core
- `continuous/sites-capability-planner.mjs` is pure JavaScript and requires no Node, local server, filesystem or GPU.
- Host-provided capabilities are explicit. Missing capabilities remain blocked.
- Autonomous model changes, code deployment and account actions require separate approval and host permissions.
- `bounded-agent-workflow.mjs` can orchestrate trusted handlers, but it does not isolate malicious code.
- `scoped-memory-index.mjs` can filter memories in RAM, but Sites needs a trusted persistence/authentication layer.

## Integration contract for Sites
1. The Sites host supplies a list of implemented capabilities.
2. Call `planSitesTask({goal,capabilities})` to determine eligible actions.
3. Map each eligible action to a real Sites-supported handler. Never simulate a tool call as a completed operation.
4. Show planned actions and missing capabilities in the UI.
5. Require explicit approval before publishing, changing code or contacting external services.
6. Record test evidence and rollback references when available.

## Not yet integrated
- The ChatGPT Sites project itself has not been edited.
- Sites storage, authentication and tool execution capabilities have not been inspected.
- GitHub changes remain in the draft PR branch pending validation.
- No GPU benchmarks are necessary for this deployment target.

## Next implementation priorities
1. Read the actual Sites project's data and API boundaries.
2. Build a host adapter for supported Sites actions.
3. Wire a durable task ledger, permission prompts and memory persistence.
4. Test the UI against missing/offline capabilities.
