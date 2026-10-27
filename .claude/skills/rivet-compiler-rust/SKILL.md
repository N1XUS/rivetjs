---
name: rivet-compiler-rust
description: Use when a change needs the Rust/oxc compiler (libs/compiler/rust/**) — who may edit it, the Docker-only wasm build, and the gates that must follow (compiler tests, parity, zero-cost, typescript-plugin build).
---

# Rivet compiler (Rust → wasm)

## Who edits

- Only the root / orchestrator agent edits `libs/compiler/rust/**` and runs the build. Subagents write a patch file (unified diff + what / why + verify steps) to the coordinator's patch queue.
- Prefer new code in `rust/src/compile/*` modules over growing `compile.rs`.
- No Rust toolchain on the host, never install one (no rustup / cargo / brew). Build only via Docker.

## Build

1. `docker ps` — no other `rust:` build container running against the same tree; never touch the user's containers.
2. `sh libs/compiler/rust/build.sh` (read it first; long → `nohup` + wait on the log).
3. Check the wasm actually changed: `shasum` before / after.

## Gates after a build

- `npx vitest run --project compiler`
- `npx nx run compiler:parity` (oracle corpus `N/N corpus cases match`)
- `sh scripts/zero-cost/check.sh` (`--update` only for intended lane deltas, stated in the commit)
- `npx nx run typescript-plugin:build`
- Diagnostics text changed → `libs/compiler/codes.json` + `node libs/docs-kit/cli.ts errors apps/docs` (then `--check`), language-core quick fixes, `libs/compiler/CLAUDE.md`.
- Commit the wasm with `--binary` patches; see `rivet-safe-commit`.
