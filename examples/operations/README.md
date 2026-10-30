# Operations integration fixture

A maintained synthetic production app for testing Rivet integration: a keyed incident dashboard, SQLite-backed service desk, store checkout and article catalogue. Tests cover sessions/tenant policies, concurrent edits, JS-off forms, live updates, SSE/WebSockets, serialization and lifecycle stress.

The application's authentication, roles, tenant filters, upload rules and checkout logic belong to this fixture. They are not automatic Rivet features or a production authentication starter.

From the repository root with existing workspace dependencies and Chromium installed:

```sh
npx vitest run --project examples examples/operations/tests --maxWorkers=1
node scripts/tsc.ts -p examples/operations
```

Each production suite gets its own copied build, SQLite database and ephemeral loopback port. Logs/screenshots remain under `.artifacts/operations-tests/`. No Next/React/Solid control installation or external service is needed.

Manual app: `cd examples/operations && npm run build && npm start`. `OPERATIONS_DB` selects the database (default `.artifacts/operations.sqlite`). All accounts and data are synthetic; demo password `demo-pass-2026`, identities `alice@alpha.test`, `bob@beta.test`, `viewer@alpha.test`, `editor@alpha.test`, `admin@alpha.test`.
