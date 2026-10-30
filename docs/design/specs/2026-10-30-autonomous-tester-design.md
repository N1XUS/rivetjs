# Autonomous Rivet tester — v1 design

Status: approved by the user (2026-10-30); implementation verified, live campaign tracked in the plan. The user chose an autonomous tester that finds bugs, minimizes a reproduction, adds a regression test, fixes and commits. This is separate from the draft lane-orchestrator design; that existing draft stays untouched.

## Outcome

One local CLI invocation investigates one bounded area of Rivet. It either lands one independently verified fix, records a supported scenario with no finding, or stops with an actionable failure and its evidence. A model's completion message never establishes passing behavior. The first release works end to end without a dashboard, parallel workers or a recurring scheduler.

## Approach and choices

The user selected autonomous testing rather than a general coding-agent orchestrator. For v1, use the installed Codex CLI, defaulting to the user's configured model and authentication; no new SDK, API key or provider abstraction is needed. An explicit harness-only model override was subsequently authorized (see amendment below). The inspected CLI supports workspace-write, JSONL events, a final output schema and an output-message file. The CLI process is a worker; a deterministic Node 24 supervisor controls verification and intake.

An agent running directly in the shared checkout would make evidence and unrelated work harder to protect. Instead, investigate and repair in an independent Git snapshot, then validate and intake a named patch. Full isolated dependency installation is expensive; use a private node_modules layout with third-party dependency links and workspace package links redirected to the snapshot. Do not link the entire root node_modules: Rivet imports must resolve to snapshot libraries. Test this with a deliberately different library value and real module-resolution execution.

## Interface

Implementation location: `scripts/ai-tester/`, tests under `scripts/tests/ai-tester*.test.ts`, evidence under `.artifacts/ai-tester/<run-id>/`.

Commands:

```sh
node scripts/ai-tester/cli.ts doctor [--model <slug>]
node scripts/ai-tester/cli.ts run --area reactivity
node scripts/ai-tester/cli.ts run --area reactivity --model gpt-6-astra --no-commit
node scripts/ai-tester/cli.ts run --area router
node scripts/ai-tester/cli.ts run --area resume
node scripts/ai-tester/cli.ts status [run-id]
```

`run` is foreground, one finding at most, default wall budget 30 minutes for the whole run and 3 GiB process-tree memory. A repository-local exclusive lock admits one campaign; subprocesses run with `nice -n 10`, one heavy check at a time and Vitest maxWorkers=1. A timeout, memory violation, interrupt, provider failure or child crash cannot become `no-finding` or `committed`. TERM followed by bounded KILL cleans up owned process groups and releases locks in finally. No infinite retry or background continuation. Individual log/event/evidence files remain after a failed run. Explicit configuration may lower budgets; raising the repository's memory limit is unsupported.

An explicit `--no-commit` stops after independent verification and leaves a patch/report. The default `run` performs the commit authorized by the user if all gates pass. No push, deployment, publishing or changes to global agent configuration.

## Bounded campaigns

Initial areas use existing maintained infrastructure:

- `reactivity`: stores, signals, computed, batch, disposal; typed API only, including generated/stateful operation sequences and small reference models.
- `router`: guards, data/actions, request isolation, serialization and escaping; use the production operations fixture where browser behavior matters.
- `resume`: cold first interaction, keyed DOM identity, delayed chunks, state/input retention and transport cleanup; production browser behavior, not warm-only tests.

Each area has a committed investigation brief with source/test scopes, starting scenarios, commands, explicit expected behavior and known design limits. The worker may invent variations and small synthetic fixtures, but cannot change the public contract just to make an assertion green. Compiler Rust, release/build infrastructure, gates, harness code/configuration, known-red/quarantine registries, dependency locks and protected user files are outside worker fix scope. A finding requiring those changes is reported as needs-attention with its repro.

The supervisor starts from a fixed HEAD and a recorded source inventory, excluding user WIP. Shared-checkout dirty paths are protected even if they fall within the nominal area scope. The existing examples/operations fixture is synthetic application policy; findings must distinguish fixture errors from framework defects and documented limitations.

## Run protocol

1. **Prepare:** validate inputs/tools, acquire the campaign lock, record HEAD, dirty/staged path inventory and configuration, create a snapshot. Copy repository instructions and inject a task brief. Preserve current untracked user files in place; never import them into the snapshot or modify them.
2. **Investigate:** the worker runs source/browser/state probes within the chosen area and records the scenario, expected result, observed result and commands. Maintain a coverage journal keyed by scenario and source revision so later runs can vary their probes; do not claim a scenario remains covered after its relevant source changes.
3. **Reproduce/minimize:** for a claimed supported bug, retain the smallest useful source fixture and executable test command. A fresh reproduction must fail before implementation. Store console/server/browser evidence when applicable. Do not invent a bug when no supported failure is found.
4. **Repair:** add a permanent native regression test in the owning maintained suite and the smallest production fix, updating nearest CLAUDE/documentation. The worker returns a strictly validated structured result containing disposition, finding, repro artifacts, regression selector, changed paths and explanation. The worker does not commit or push.
5. **Independent verification:** the supervisor creates a fresh validation tree. Overlay only regression/fixture additions onto the base and run the exact regression: it must be discovered, execute, and fail for the recorded behavioral assertion. Collection/import/setup errors, timeouts, missing browsers and zero-test runs are infrastructure failures, not RED evidence. Apply the production repair and rerun the same selector: the same test must pass. Run affected gates using the trusted supervisor/base gate implementation; require complete expected gate reports, not just exit 0. Known reds remain visible, and no weakened/skipped assertion or automatically increased baseline is accepted.
6. **Review:** a separate read-only Codex invocation reviews the actual patch, reproduction, RED/GREEN logs and gate results. It checks supported contract, minimization, test validity, unrelated changes, public behavior and assertions removed/weakened. A structured blocking verdict, malformed/missing result or reviewer crash prevents intake. The review may not edit tests, approve itself or mutate harness policy.
7. **Intake/commit:** require original HEAD still current, no candidate path dirty/staged in the shared checkout and no protected path in the patch. Recheck candidate bytes before intake. Apply only named verified paths, commit through a temporary index with the repository's Conventional Commit/co-author rules, then synchronize only those paths in the real index. A moved HEAD or overlapping user edit becomes needs-attention; do not silently rebase or overwrite. A correct repair requiring an intentional zero-cost/size/frame baseline update also stops as needs-attention; the tester cannot update its own acceptance thresholds. Record the resulting commit SHA and proof hashes. Unrelated staged/unstaged changes survive exactly.

The supervisor validates all paths as repository-relative regular files with no traversal/symlink escape. Commands are argument arrays with no shell interpolation. Worker-provided shell command strings are not executed by intake: supported regression/gate invocation is constructed from validated project/file/test selector fields and committed area policy. Snapshot dependencies and instruction prompts are not a security boundary against a malicious agent; enforce the actual CLI sandbox and supervisor-owned write scope, and do not pass secrets or production credentials to test fixtures.

## Evidence and statuses

Per run: `run.json`, append-only `events.jsonl`, area brief, worker/reviewer JSONL and final JSON, minimized repro, named patch/path manifest, base/fixed test reports, gate reports, intake report and logs. A terminal record distinguishes `committed`, `verified` (--no-commit), `no-finding`, `needs-attention`, `failed` and `interrupted`. Valid no-finding results include executed probes/evidence and no source changes; they are not security or production-readiness certification.

The structured result is a proposal. Supervisor-produced evidence and statuses are authoritative. Invalid/missing structured results, unexpected edits, missing evidence or incomplete validation fail closed. Coverage history is data, not self-editing agent instructions; v1 has no automatic policy learning.

## Acceptance

- Deterministic subprocess integration tests exercise the real supervisor using a scripted worker/reviewer against tiny disposable repositories: a seeded supported bug produces RED→GREEN and exactly one correct commit; a no-finding result does not commit.
- Negative cases cover zero tests, broken imports, fake/missing reports, false RED, regression still failing, review rejection, changed HEAD, dirty candidate paths, unrelated staged/unstaged WIP, traversal/symlink paths, provider error, interrupted/timeout processes and lock contention. No negative case may commit.
- A resolution isolation test proves snapshot @rivetjs imports execute snapshot source rather than the shared checkout.
- Node 24 typechecks, changed-file formatting and the complete scripts Vitest project pass. Existing examples and gates are invoked unchanged as applicable.
- Run one real Codex campaign in --no-commit mode after installing the supervisor. Record actual provider availability and actual outcome; a scripted integration test is not presented as a live AI discovery. Run default auto-commit only after deterministic intake tests and independent review pass.

## Deferred scope

Parallel lanes, provider failover, dashboard, scheduling, exhaustive fuzzing, automatic baseline updates and automatic changes to the harness's own policy. The existing lane-harness draft remains a separate proposal.

## Builder check

A fresh read-only reviewer found no important user questions left before planning. Snapshot resolution, supervisor-owned verification, provider availability and shared-worktree intake have explicit acceptance checks. Implementation details of locking/report validation remain with the builder. The user approved this design with “Ок”; implementation and live verification are tracked in the matching plan. The installed Codex CLI reports version 0.153.4 and an existing ChatGPT login; live inference availability is still untested.

## Authorized provider amendment

After actual inference rejected the configured model, the user explicitly approved selecting a compatible model only for the harness. Optional `--model <slug>` now overrides worker/reviewer/doctor per invocation; omission preserves the configured default and existing authentication. No silent model/provider fallback or global configuration changes. `doctor` performs one bounded read-only inference with strict structured output, completed-turn validation and retained diagnostics before an expensive campaign. Private CLI inspection disables inherited MCP integrations, apps/plugins and parallel agent tools for these invocations. Readiness proves provider access only; live investigation still needs its own executed evidence and supervisor acceptance.
