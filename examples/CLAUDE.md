# examples/

Runnable backend examples (plan `docs/design/plans/2026-10-12-backend-examples.md`, spec `docs/design/specs/2026-10-12-backend-examples-design.md`). Each dir = one self-contained Rivet server app.

- Landed: `sqlite-local` (E1). Rest of the plan (compose stacks, `scripts/examples/*`, `_shared`) not yet; T1 reduced to: vitest project `examples` + CI job `examples`.
- Not npm workspaces yet (adding one needs a lockfile refresh with network): examples resolve `@rivetjs/*` + `vite` through the root `node_modules`. Revisit with T1 full (`examples/*` workspace glob, `package-lock.json`).
- Tests: `npx vitest run --project examples --maxWorkers=1` (`examples/*/tests/*.test.ts`, node env, 180 s timeouts): build the example, boot the production server on 127.0.0.1:4470–4479, in-process fakes only. No Docker, no network, ever in CI.
- Example layout: `package.json` (`rivetExample` metadata: name, title, summary, services, backends, jsBudgetKB), `vite.config.ts`, `serve.ts`, `src/routes/**`, `src/server/*.server.ts` (server-only code), `migrations/*.sql`, `scripts/{migrate,seed}.ts`, `tests/`, `.env.example` (fake dev values only), `README.md`, `CLAUDE.md`.
- Rules: exact pins / `node:sqlite` (no native addons); lucide icons via `@rivetjs/kit/icon`; handlers are inline arrows; update the example's README + CLAUDE.md with its code.
