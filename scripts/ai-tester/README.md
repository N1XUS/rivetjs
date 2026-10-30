# Autonomous Rivet tester

One local campaign asks Codex to investigate a bounded area, minimize one supported bug, add a native regression and repair it. The supervisor independently replays RED/GREEN, runs affected gates, requests read-only review and commits only the verified named files. Worker completion alone is not a pass.

Requires existing workspace dependencies, Node 24+, the installed/authenticated Codex CLI and `ps` process inspection. Browser areas also need the repository's Playwright browsers. The user's configured Codex model/authentication are inherited; the harness does not select a model or install tooling.

From the repository root:

```sh
node scripts/ai-tester/cli.ts run --area reactivity --no-commit
node scripts/ai-tester/cli.ts run --area router
node scripts/ai-tester/cli.ts run --area resume --timeout 10
node scripts/ai-tester/cli.ts status
node scripts/ai-tester/cli.ts status <run-id>
```

Default `run` commits accepted repairs locally. `--no-commit` performs the same verification/review and retains the patch. There is no push, deployment, scheduler or parallel campaign. Areas select source/project allowlists and investigative briefs in `policy.ts`; the worker can explore variations within that contract.

- `reactivity`: typed stores/signals/computed/batch/disposal and small reference models.
- `router`: loaders/actions/guards, request isolation, serialization/escaping and production operations fixtures.
- `resume`: cold input, DOM identity, delayed chunks, input retention and owner cleanup.

The default whole-run wall budget is 30 minutes; `--timeout` can lower it. Sampled process-tree RSS (including the supervisor) is capped at 3072 MiB; `--rss-limit` can lower it. Subprocesses run with nice10, a restricted environment, a 2048 MiB V8 limit and one heavy child at a time. The monitor samples after 100 ms and every 500 ms, and fails closed when `ps` is unavailable. TERM/KILL cleanup covers observed owned process groups, including detached gate servers. It is not an OS/container memory isolation guarantee.

## Evidence and outcomes

`.artifacts/ai-tester/<run-id>/` contains the source revision/inventory, protected dirty paths, prompt, worker/reviewer logs/results, copied repro/probe evidence, native RED/GREEN JSON, gate plan/report, candidate and proof-file SHA-256 hashes/patch, run status and append-only events. Logs are capped at 50 MiB each; copied evidence at 10 MiB per file. A coverage JSONL journal records scenario, source revision and outcome for future investigations; it does not edit agent policy.

| Terminal status   | Meaning                                                                                                       | CLI exit |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | -------: |
| `committed`       | Supervisor verified/reviewed and committed the repair; SHA in run.json                                        |        0 |
| `verified`        | Same acceptance checks, explicit --no-commit                                                                  |        0 |
| `no-finding`      | Worker left probe evidence/no source edits; supervisor independently ran a nonempty passing native area suite |        0 |
| `needs-attention` | Review rejection, overlapping WIP/moved HEAD or verified candidate changed; patch/evidence retained           |        1 |
| `failed`          | Provider/process/setup failure, invalid result, false RED/GREEN, incomplete gates or budget failure           |        2 |
| `interrupted`     | SIGINT/SIGTERM forwarded through the CLI's abort signal                                                       |      130 |

A whole node_modules symlink is forbidden. Each snapshot has private workspace package and workspace `.bin` links so tests execute its sources, including installed nested workspace dependencies. Qwik packages are copied into the snapshot per the zero-cost gate's path-sensitive manifest rule. Third-party packages are shared read-only by convention and CLI sandbox restrictions; this is not a hardened environment for deliberately malicious test code.

Shared checkout changes are protected: the worker never edits main, all starting dirty/staged/untracked paths (including staged/working-tree cancellations) are excluded from the snapshot and protected at intake, HEAD must remain current, and candidate paths must still be clean. Actual candidate bytes and index blobs are also compared with the base, so assume-unchanged flags cannot hide overwritten user work. Intake acquires the Git index lock, builds a temporary index, creates a commit with an explicit parent and atomically updates HEAD only if the original parent still matches. Only candidate entries are synchronized in the real index; unrelated staged/unstaged work survives. A failed pre-commit intake restores only bytes still matching the harness's writes. No stash, reset-hard, amendment or rebase.

Worker patches cannot edit the harness, gates, configuration, locks, known-red/quarantine files, byte baselines or compiler Rust/WASM. Intentional baseline changes require human intake. Raw page handler order, Async adoption limits and unsupported array-length paths are documented contracts, not new bugs. Operations fixture session/tenant/upload/checkout rules are application policy, not framework guarantees. No-finding is a bounded investigation result, not security certification.

A live/ambiguous campaign lock is never stolen automatically. If a parent is killed with SIGKILL, inspect its owner PID and recorded artifacts before manually removing its stale `.artifacts/ai-tester/campaign.lock` directory. Keep evidence; remove only owned snapshot build trees when no campaign is using them.

## Maintainer verification

```sh
node scripts/tsc.ts -p scripts/ai-tester
npx vitest run --project scripts --maxWorkers=1
```

The integration tests use real disposable Git repositories, real native Vitest regression execution and a scripted subprocess only at the external inference/review boundary. A seeded fix proves acceptance/commit wiring; it is not a claimed AI discovery. Live provider evidence is recorded separately in the implementation plan.

## Provider setup failures

The driver inherits the installed Codex CLI's configured model/authentication. If the worker fails with model_not_found or an account/model compatibility error, inspect the worker log and repair the CLI profile before retrying. Cached model listings do not establish successful inference access. The harness does not silently substitute models or modify global Codex settings. The first actual verification attempt after snapshot startup was repaired encountered this configuration failure; live discovery is not claimed on that evidence. See `docs/design/research/2026-10-30-autonomous-tester-verification.md`.
