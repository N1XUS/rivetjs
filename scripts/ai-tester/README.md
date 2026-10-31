# Autonomous Rivet tester

One local campaign asks Codex to investigate a bounded area, minimize one supported bug, add a native regression and repair it. The supervisor independently replays RED/GREEN, runs affected gates, requests read-only review and commits only the verified named files. Worker completion alone is not a pass.

Requires existing workspace dependencies, Node 24+, the installed/authenticated Codex CLI and `ps` process inspection. Browser areas also need the repository's Playwright browsers. Model/authentication default to the CLI configuration. Optional `--model <slug>` selects a model only for this harness invocation; it never changes global settings or installs tooling.

From the repository root:

```sh
node scripts/ai-tester/cli.ts doctor --model gpt-6-astra
node scripts/ai-tester/cli.ts run --area reactivity --model gpt-6-astra --no-commit
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

Once an in-scope finding reaches a fresh validation snapshot, `candidate.patch` and `paths.json` are retained before native RED/GREEN or heavy gates. They describe an unverified proposal until the terminal acceptance checks pass. Patch serialization uses a separate index and raw blobs, preserving binary/non-UTF8 data, existing executable modes and trailing whitespace; it ignores display-only Git diff preferences. This permits human handoff after a failed proof or resource limit without rediscovering the candidate.

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

Vitest `-t` reports unrelated tests in the selected file as skipped/todo. Regression proof accepts those records only with consistent native totals and exactly one matching executed assertion, retaining the same full identity across RED/GREEN. A skipped selected test, multiple executed tests or setup failure remains invalid.

Source verification covers every original tracked blob, not just changed-path metadata or named candidate files. RED permits only the declared test/fixture overlay; GREEN, gates and review must retain the exact complete candidate over the unchanged base. Hidden writes to another tracked source file are rejected even when Git index flags conceal them. These checks do not provide malicious-code/container isolation.

## Provider setup failures

Run `doctor [--model <slug>]` before an expensive campaign. It holds the campaign lock, runs one read-only inference in an empty disposable directory and requires an exact structured response plus a completed CLI turn. Its wall budget is 60 seconds and sampled RSS limit 3072 MiB. Exit 0 means provider readiness only; exit 2 means failure and 130 means interrupted. Evidence is retained under `.artifacts/ai-tester/diagnostics/<id>/`.

Private CLI inspection discovers configured MCP server names and verifies per-process overrides disable every server; raw configuration output is never logged. Worker, reviewer and doctor also disable apps, plugins and parallel agent tools. Unsupported or managed configurations that prevent isolation fail closed. Existing CLI authentication is retained.

`model_not_found` requires a compatible explicit `--model` or a user-repaired CLI profile. There is no silent fallback or global setting change. Cached catalogs do not establish inference access. On 2026-10-30 the configured `gpt-6.1-sol` failed with this account; the user authorized a harness-only override, and `doctor --model gpt-6-astra` completed actual inference. See `docs/design/research/2026-10-30-autonomous-tester-verification.md` for separate provider and campaign evidence.

No-finding acceptance checks native assertion records and consistent counts: skipped/todo-only suites cannot pass. Existing mixed suites need at least one actual passing assertion and no failures. The supervisor then checks snapshot HEAD, inventory and every committed source blob against actual bytes, including files hidden by Git index flags. Nested Git/npm/environment/agent configuration remains protected from worker edits.
