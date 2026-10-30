# Operations integration fixture

Maintained synthetic app for native Vitest `examples` suites. Sources migrated from the retired adversarial lab; original reports/assertions are archived under `docs/design/research/archive/`.

- Routes: incident dashboard, service desk (`/desk`), shop (`/store`), articles (`/dispatch`), authentication, stream and rich serialization controls. Application-owned SQLite sessions, tenant/role/checkout/upload policy are test fixtures, not framework-provided security or production authentication guidance.
- Test helper `tests/_support.ts` copies/builds each suite into `.artifacts/operations-tests/<unique>/`, uses a fresh `OPERATIONS_DB`, starts an ephemeral 127.0.0.1 child server, and owns bounded cleanup. Tests never change cwd or share ports/databases. Browser suites run with `--maxWorkers=1`.
- `serve.mjs` integrates `ws` with the Node adapter. Public transport stats test owner cleanup; private upgrades enforce origin/session/tenant policy and revocation. Shutdown terminates its sockets before draining HTTP.
- Keep tests native Vitest with real throwing assertions; never restore old catch-and-write-result wrappers or unsupported array-path probes. Expected design-limit and competitor assertions stay historical, not skipped passing tests.
- Commands: root `npx vitest run --project examples examples/operations/tests --maxWorkers=1`; `node scripts/tsc.ts -p examples/operations`; manual `cd examples/operations && npm run build && npm start` (synthetic data only).
