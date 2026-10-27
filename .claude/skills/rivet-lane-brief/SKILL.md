---
name: rivet-lane-brief
description: Use when the coordinator spawns a background lane agent for Rivet work (perf, bug, port, docs) — template for the brief: base snapshot, host limits, scope, measurement, patch hand-back and report contract.
---

# Rivet lane brief

Lane = one background agent, own snapshot, hands back patches. Coordinator lands them (see `rivet-intake-gates`, `rivet-safe-commit`).

## Before writing

- ≤ 6 lanes total; ≤ 4 when any lane benchmarks. Big work = landable slices (~2 h each).
- Unknown area → a read-only sonnet scout (~10 min) first; brief cites its report.
- Pass `model: "opus"` (or the model the user asked for) explicitly.

## Brief sections (copy, fill)

1. **Goal** — user's words verbatim + acceptance as numbers (bytes, µs, test names). Small AND large cases (≥ 100-element interactive page) for any perf claim.
2. **Base** — `HEAD` sha. Snapshot: `git archive <sha> | tar -x -C <snap>` then link node_modules (coordinator's mksnap script); never edit the main checkout, never commit / push / rebase, no worktrees, no subagents.
3. **Scope** — files owned, files forbidden (other lanes' areas, user WIP, `libs/compiler/rust/**` unless root-approved — then patch file only, see `rivet-compiler-rust`).
4. **Host** — PATH line, `nice -n 10`, RAM ≤ 3 GB / tree, vitest `--maxWorkers 1–2`, one browser project / one docs build at a time, ports given explicitly (4400+; 4320–4329 are the user's), never touch the user's Docker containers, no host installs, no secrets, no publish / deploy.
5. **Gates in lane** — targeted test files + typecheck of touched projects + runtime-hash diff only. Full suite runs once at intake.
6. **Hand-back** — `<dir>/onmain-<sha>-NN-<topic>.patch` (`--binary` if wasm), `paths.txt`, `msg.txt` ending with the Co-Authored-By trailer; report `<LANE>-report.md`: what / why / numbers before→after + command / gates + results / `Ruling: <what> — <why> — <cost if wrong>` / known reds / cross-lane notes. Docs follow code inside the patch.
7. **Cleanup** — stop servers, remove snapshot dist / A-B dirs at the end (repo once hit 22 GB of gitignored copies).
