# @rivetjs/bridge-svelte

> Keep this file current whenever code in this directory changes.

Svelte 5 adapter for Rivet framework islands (framework bridges design, T11).

- `server.ts`: native `svelte/server` render with island `idPrefix` and CSP nonce; sync and async results, separate head. Svelte 5.57's result is always thenable: read `body` / `head` first, then await only on native `await_invalid`. Ordinary component failures rethrow. Svelte exposes no request abort option.
- `client.ts`: native hydrate (`recover: false`, so the bridge reports RV2149 and mounts once), mount and unmount. Every fresh mount first calls `discardNativeHead("svelte", ctx.id)` so a failed hydration cannot leave a duplicate SSR head range or touch unrelated resources.
- `props.svelte.ts`: compiled `$state` props proxy, updated by assignment and key deletion without remounting.
- `holes.ts`: shared raw snippets for default, named and legacy slots; exact core hole markup, adopts Rivet-owned nodes. Client handles keep the same snippets across prop updates so slot wrappers and nested island roots stay in place.
- `vite.ts`: `.svelte`, `.svelte.ts`, `.svelte.js` ownership; official Svelte plugin, external CSS, Svelte deduplication. Always exclude `\0` virtual modules: bridge definition/client JavaScript module ids can end in `.svelte` and are not SFC source.
- `types.ts`: Svelte 5 Component props and branded Snippet content become Rivet island props. Require the two-argument Svelte component signature so Rivet functions stay Rivet. Test prop-to-Snippet assignability, because the reverse direction misclassifies void callbacks as content.
- Exact tested development pins: Svelte 5.57.2, vite-plugin-svelte 7.3.1. No Svelte source is vendored.

Run `vitest run --project bridge-svelte --project bridge-svelte-browser --maxWorkers=1` and
`node scripts/tsc.ts -p libs/bridge-svelte` with Node 26 and `NODE_OPTIONS=--max-old-space-size=2048`.
The browser test project must include the Svelte Vite plugin to compile rune modules and SFC fixtures.
Native tests compile SFCs into temporary `.compiled-*` directories under fixtures and remove them afterward.
`tests/fixtures/html.ts` is actual native SSR output, verified by the native suite before use in browser hydration tests.
The production build test also exercises a compiled resumable Rivet slot button, static-only scoped CSS, and a consumer of emitted `props.svelte.js` under `node_modules`; the official Svelte plugin must compile that emitted rune module. The emitted-package consumer hydrates actual production SSR head through router rank merging/serialization, preserves the original meta node, updates metadata/title with props, and removes native metadata on unmount.
Native head uses `@rivetjs/bridge/head` `nativeHead` with the request CSP nonce on both synchronous and asynchronous server paths. Its server-only lifecycle bootstrap receives that nonce. The server head sink keeps exact Svelte comment ranges under per-island markers; enumerable normalized fields remain navigation payload data. `@rivetjs/bridge/head-client` `withNativeHead` masks other islands' comment markers during hydration, so repeated SFCs can hydrate in any policy order without claiming each other's metadata. All hydration and fresh mounts await public `settled()` before reporting driver readiness: native `hydrate`/`mount` can return before experimental async body handlers exist. This also keeps head scopes masked until asynchronous initialization completes and ensures intent's recorded first click replays after handlers are installed. SSR meta/link identity and independent head cleanup are covered in Chromium.
Native head requires an early document head hold. The router rejects a native island head arriving after that hold, and rejects competing native title authors/title templates; it never silently duplicates metadata. Svelte components without `svelte:head` can still use async SSR in streamed segments.

Documented APIs: [Svelte runtime](https://svelte.dev/docs/svelte/svelte),
[Svelte server rendering](https://svelte.dev/docs/svelte/svelte-server).

Scoped CSS SSR collection follows the island's static Vite import closure. Statically imported children remain covered when conditionally or asynchronously rendered. A child reached only through runtime `await import("./Lazy.svelte")` is outside that closure: Svelte 5.57's public SSR result has no rendered-module collection hook, and external CSS remains separate compiler output even when the child emits scoped HTML. Such dynamic child CSS is not guaranteed before hydration or for server-only/static islands; the client dynamic import can load it later. This is an experimental dynamic-import CSS limitation, distinct from supported async SSR rendering itself.
