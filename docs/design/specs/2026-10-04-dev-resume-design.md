# Dev resume (gap S-3, E16 DOM side)

Date: 2026-10-04. Status: implemented (step 1 recorder errors, step 2 dev resume).

## Problem

- `vite serve` rendered pages with `renderToWriter` and client-rendered them over the server HTML (`entry.dev.tsx`): the resume recorder, serialization, chunk resolution, loader and `dom-resume` never ran in dev.
- Serialization / chunk / resume bugs only showed in production builds (e.g. a cold link click doing a full page load).
- Qwik and Marko dev = prod resume path; SvelteKit / Remix / Solid Start / Next dev hydrate like prod (same mechanism, unbundled modules). Rivet dev was the outlier.

## Decisions

- Step 1 (record + report), always on in dev:
  - dev SSR renders through `renderResumable` with a dev manifest (`api.devResume.manifest()` of the compiler plugin): symbol id → Vite-served chunk URL, resolved from the symbols the dev server's SSR transforms produced (a symbol no resume-compiled module defines = "no chunk").
  - Recorder errors (non-serializable captures: functions, class instances, rendered JSX; missing chunk ids; detached refs) throw as in production; the dev error reporter names the component, its source location and the capture (`in <Counter> (src/routes/index.tsx:4:17), capture \`when\` (…:6:9)`), sends the overlay `loc`, and the page opens the overlay itself — also when the failure happens after the response started (state is encoded at the end of the shell: status 200 already sent; the dev handler appends the overlay script to the truncated body).
- Step 2 (full dev resume), default; `rivetRouter({ dev: { resume: false } })` opts out (step 1 only: recorder runs, its state/loader are cut from the page, the page loads `dev-mount.tsx` and client-renders as before).
  - Server: same HTML as production (ids, markers, state, inline loader, preload hints) inside `<div data-rivet-dev="resume" style="display:contents">`, followed by `@vite/client` and `entry.dev.tsx`; no embedded route data.
  - Chunks: `<module>?rivet-chunk=<Component>` (prod default `chunks: "component"` grouping), compiled by `compileSymbolModule` like production chunks; locals come from the module itself (dev client modules of resume modules compile in resume mode, which only adds the locals export list). Runtime: the resume entry (`/.rivet/entry.resume.ts`).
  - Not mirrored: `chunks: "group" | "route"` grouping, sizes/impact ties, `lazy` prefetch lists, module-level `export const preload`, app preload rules (dev manifest has none), build hash. Default preload scheduling, intent prefetch, cold replay, `clientEvent`/`clientEffect` triggers run unchanged.
  - HMR: resumed regions run symbols, not hot-wrapped components, so they cannot be hot-replaced. On the first JS hot update the page falls back: the resume runtime is disposed (`dispose()`, dev builds only), the app client-renders from fresh route data, then `hot.ts` replaces components in place (state kept from then on). The first switch loses resumed signal state (no component instances to map it to). The page's modules load at idle (not executed as components) so edits reach the page as hot updates; edits that reach no boundary full-reload (fresh SSR + resume). Server-only edits (`rivet:data`) reload a resumed page. Chunk modules self-accept (no reload through them).
  - Resume errors (`rivet:resume-error`) go to the overlay; the loader's reload fallback is prevented in dev (the overlay stays).
  - i18n: non-default locales client-render (their module graphs compile per locale through `?rivet-locale=`; chunks do not carry it yet).
- E16 (DOM): a cache-busted (`?t=`) URL of a framework module (`@rivetjs/runtime`, `reactivity`, `router`, …; not app code) is served as a re-export facade of the plain URL, so the browser keeps one instance per module; an edit to a framework source full-reloads the page instead of hot-updating importers into a second runtime copy.

## Zero cost

- Production HTML and bundles: unchanged. Runtime: `dom-resume` gains a `DEV`-only `dispose()` (folds away in production resolution; zero-cost hashes unchanged). Everything else lives in the dev server (router `build/`, compiler Vite plugin, generated `entry.dev.tsx` / `dev-mount.tsx`, which builds never load).

## Rejected

- Client-render, but hydrate-check against the server HTML: still not the resume path.
- Per-symbol module URLs (`?rivet-symbol=id`): more requests than prod's per-component chunks, no better fidelity.
- Hot-replacing resumed bindings by re-running their symbols: covers text/attribute bindings only; regions, handlers' captured closures and effects would need re-capture, i.e. a re-render anyway.
