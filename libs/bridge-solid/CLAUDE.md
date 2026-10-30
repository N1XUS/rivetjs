# @rivetjs/bridge-solid

Keep this file current with package changes. Solid **1.9** adapter, T9 of `docs/design/plans/2026-10-11-framework-bridges.md`; Solid 2 is a separate API and unsupported. Development pins Solid 1.9.15 and vite-plugin-solid 2.11.14.

- `server.ts`: synchronous native SSR; Solid's pending Suspense serialization sentinel `="$$f"` triggers `renderToStringAsync`. Public `catchError` captures resource errors that Solid otherwise serializes as successful HTML; the adapter rejects after completion. Render ids and CSP nonce passed through. `head` generates the hydration script; bridge core deduplicates per page. Event recording disabled because compiler uses direct listeners.
- `client.ts`: `hydrate` / `render`, a store per island, `reconcile` replaces snapshots including deleted keys, `unmount` disposes once. A dedicated component `createRoot` captures its disposer before user code runs, so a throwing mount/hydrate disposes all component effects before rethrowing. Solid’s internal render root is detached; an outer root alone cannot clean it, and `catchError` handlers can defer through the effects queue. Later reactive errors propagate. Hydrated raw slot holes consume no Solid hydration keys; cached lazy getters return the existing hole and preserve Rivet-owned nodes. Mounted holes receive the same nodes. Solid local state survives prop updates.
- `slot.ts`: default → children; hyphenated names → camelCase.
- `vite.ts`: `solid()` owns `.solid.tsx` / `.solid.jsx`, leading `@jsxImportSource solid-js`, include/exclude. Native plugin always uses hydratable SSR and `delegateEvents:false`: Rivet's full/lite/spread dispatch uses separate `$r<type>` keys, so precompiled Solid delegated `$$click` handlers are also isolated. Native transform gate follows the ownership function, including pragmas. Npm includes follow bridge core's package ownership rules.
- `types.ts`: registry augmentation matches Solid's broad JSX.Element component return type, retains required props / callback types and exposes island options. Narrow DOM-returning Rivet components retain native props.
- Components in a Rivet TypeScript project need a leading `/** @jsxImportSource solid-js */`, a scoped Solid tsconfig, or an explicit `Component<P>` annotation: TypeScript does not select JSX types from the `.solid.tsx` suffix.
- Root repository has Solid 2 for benchmarks. Vitest and integration Vite builds must explicitly alias all three Solid entries to this package's nested Solid 1.9 (server builds: server.js for core/web/store; browsers: solid.js/web.js/store.js). Never dedupe test fixtures to the root Solid 2.
- `tests/fixtures/components.solid.tsx` must compile with native vite-plugin-solid (SSR in node; DOM in browser). SSR fixture markup is generated from those native components, then consumed in browser tests.
- NOTICE reproduces upstream Solid's MIT license. No framework source vendored.

Commands from repo root, Node >=24, maxWorkers1 and <=2GB V8:

`NODE_OPTIONS=--max-old-space-size=1536 npx vitest run --project bridge-solid --project bridge-solid-browser --maxWorkers=1`

`node scripts/tsc.ts -p libs/bridge-solid`
