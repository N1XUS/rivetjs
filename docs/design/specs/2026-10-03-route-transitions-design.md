# Route transitions + pending UI (design)

Builds on [router design](2026-10-03-router-design.md), [resumability](2026-10-03-resumability-design.md) ([status](../../guides/resumability.md)), [async streaming](2026-10-03-async-streaming-design.md). Code read: `libs/router/client/index.ts`, `libs/router/build/codegen.ts`, `libs/runtime/dom-router.ts`, `libs/runtime/router.ts`, `Async`/`lazyComponent` in `libs/runtime/dom.ts`.

## Current behaviour (what this changes)
- `createRouter().navigate` → `pushState` + `href.set` immediately → Router's `Async` effect reruns.
- Rerun cleanup disposes the previous generation's root at once: old page DOM stays visible (no `fallback` in generated Router) but its scopes/effects/handlers are dead until the new commit.
- `load` = `routeData` (data endpoint, prefetched on intent). Page component = `lazyComponent(…, { warm: false })`: if the chunk is not in yet, render creates an inner `Async` → old region cleared, page appears one chunk later (two DOM changes, blank frame).
- `settle(url)` runs inside `render` (before insertion) and polls `requestAnimationFrame` ≤30 frames for an `h1`, then scroll (restore/hash/top) + focus.
- Only root `_layout` persists (signal props); nested layouts re-render with every route. (Since G12 every layout persists: [routing: nested layouts](../../guides/routing.md#file-routes-nested-layouts).)
- No pending signal, no pending attributes, no transition hook.

## Goal
- Animated route changes via View Transitions (same-document for client nav; cross-document for MPA/no-JS/static), incl. shared-element morphs, per-route/per-link types, direction.
- Pending UI: global navigation state, link/region pending attributes, delayed indicators/skeletons without flashes.
- One atomic swap per navigation: data + page chunk ready → single DOM commit (with or without animation).
- Layouts that did not change stay mounted; only changed segments swap/animate.
- CSS-only customization by default; JS hooks for the rest.
- Strict CSP + Trusted Types unchanged; no inline `style` attributes emitted.
- Zero cost when unused: generated code byte-identical, 0 extra bytes before first navigation, SSR bench unchanged.
- Resumability kept: no component runs on page load; transition code loads only on first client navigation.

## Non-goals
- JS animation engine / simulated transitions in browsers without View Transitions (instant swap instead).
- Polyfill for `startViewTransition`.
- DOM keep-alive of previous routes (memory, live effects); data back-cache only (later phase).
- Gesture-driven (scrubbed) back transitions; Safari/Chrome native swipe animations are respected, not replaced.
- Element-level (non-route) transitions API (authors call `document.startViewTransition` themselves).
- Enhanced (JS) form submission; optimistic hooks depend on it and are only sketched.

## Prior art
| Framework | Transition trigger | Shared elements | Types / direction | Pending API | Delay/min | Fallback | Notes |
|---|---|---|---|---|---|---|---|
| Astro `<ClientRouter/>` | router wraps swap in VT after fetch | `transition:name` (compiled to inline `view-transition-name`) | `transition:animate` (fade/slide/none), back auto-reversed via `data-astro-transition=back` on `<html>` | `astro:before-preparation` … `astro:after-swap`, `astro:page-load` events; `event.loader` override | none built in | `fallback="animate"` (CSS sim) / `swap` / `none` | `transition:persist` keeps islands across pages; recommends native cross-doc `@view-transition` for MPAs; inline styles conflict with strict `style-src` |
| SvelteKit | `onNavigate(cb)`; cb returns promise → user calls `startViewTransition` | manual CSS | manual (`navigation.type`) | `navigating` (`$app/state`): from/to/type/willUnload | none | user's | VT waits for load; update resolves when DOM updated |
| Next.js / React | `startTransition`; experimental `<ViewTransition>` component + `viewTransition` flag | `<ViewTransition name>` | `addTransitionType()`, `enter/exit/share/update` props | `useTransition` isPending, `useLinkStatus` (Link), `loading.tsx` = Suspense skeleton | React throttles Suspense reveals (~300 ms) | no animation | old UI stays interactive during transition (concurrent render) |
| Angular | `withViewTransitions({ skipInitialTransition, onViewTransitionCreated })` | manual CSS | via `onViewTransitionCreated` (`transition.types`) | `Router.events` / `NavigationStart`… | none | instant | wraps route activation; skips when `skipTransition`/unsupported |
| Remix / React Router | `<Link viewTransition>` / `navigate(to, { viewTransition })` | `useViewTransitionState(to)` → name only the clicked item | `viewTransition: { types }` (RR 7) | `useNavigation()` idle/loading/submitting + location/formData; `NavLink` `isPending`/`isTransitioning`; `useFetcher` optimistic | none (community `useSpinDelay` 500/200) | instant | URL commits after loaders |
| TanStack Router | `viewTransition: true | { types }` per nav / router default | manual | types fn(`{ fromLocation, toLocation }`) | `useRouterState().isLoading`, `pendingComponent` | `pendingMs` 1000, `pendingMinMs` 500 | instant | good defaults reference |
| Qwik City | VT on SPA nav (default on) | manual | `qviewTransition` event | `useLocation().isNavigating` | none | instant | resumable: nav code loads on first nav |

Takeaways:
- Start VT only after data + chunk are ready (SvelteKit/Astro): frozen page during fetch avoided.
- Name only the participating item (Remix): unique names, no 50-thumbnail capture.
- Direction via attribute on `<html>` (Astro) works where `types` don't.
- Delay/min on indicators, never on the swap (TanStack/useSpinDelay).
- Inline `view-transition-name` (Astro) breaks strict `style-src`; CSSOM assignment does not.

## Recommendation
- Router owns the swap: `Async` gains a swap hook; Router passes `apply` to a lazily loaded transitions module that wraps it in `document.startViewTransition({ update, types })` when supported/enabled.
- Page chunk + data awaited together before commit → render synchronous → `settle` runs synchronously inside `update` (no rAF polling).
- Old page stays live (scopes not disposed) until the commit (React semantics; needed for pending UI on the old page).
- Shared elements: `data-vt-name` / `data-vt-class` attributes; router intersects names in old DOM and the detached new DOM, assigns `style.viewTransitionName` via CSSOM only for the intersection, clears after `finished`.
- Page region gets `view-transition-name: rivet-page` (CSSOM, transition-time only); default CSS disables root cross-fade so persistent layout chrome stays still.
- Types: `push|replace|back|forward` + route/link custom; mirrored as `<html data-rivet-transition="…">` for CSS where `types` unsupported.
- Pending: one navigation signal exposed through a resumable context (`useNavigation()`), `<html data-rivet-pending>`, `aria-busy` on the routes region, `data-rivet-pending` on the clicked link; delay/min-duration timers.
- Opt-in: `rivetRouter({ transitions: true })`. Disabled → codegen output unchanged.

## API

### Config (`@rivetjs/router/vite`)
```ts
rivetRouter({
  transitions: true, // or:
  transitions: {
    viewTransitions: true,          // false: pending UI only, instant swap
    reducedMotion: "skip",          // "skip" (no VT) | "allow" (CSS decides)
    pending: { delay: 200, minDuration: 300 },     // indicator timing (ms)
    skeleton: { delay: 1000, minDuration: 500 },   // route `pending` export timing
    crossDocument: false,           // phase 4: emit pagereveal names script
  },
});
```

### Route modules (universal `x.tsx`, merged layout → page, inner wins)
```tsx
// src/routes/items/[id].tsx
export const transition = { types: ["zoom"] };          // added to VT types
// export const transition = false;                     // never animate into this route
// export const transition = (nav) => nav.from?.pathname === "/" ? { types: ["zoom"] } : {};
export const pending = () => <ItemSkeleton />;          // shown after skeleton.delay
export default function Item({ data }: PageProps) {
  return <img data-vt-name={`item-${data.id}`} src={data.image} alt="" />;
}
```
- `nav` = `{ from: URL | null, to: URL, type: "push" | "replace" | "back" | "forward", trigger: "link" | "api" | "popstate" | "redirect" }`.
- Read after the page chunk loads (already awaited) → no extra request.

### Links (plain `<a>`; no `<Link>` component — anchors resume without JS)
```tsx
<a href={`/items/${item.id}`} data-transition="zoom">          // extra types
  <img data-vt-name={`item-${item.id}`} src={item.thumb} alt="" />
</a>
<a href="/settings" data-transition="none">Settings</a>        // instant swap
```
- Types precedence: link `data-transition` > route `transition` > defaults (`push`/`back`/…, always present).
- Active/pending link state: `aria-current="page"` (author or helper), `data-rivet-pending` set by router on the clicked anchor until commit.

### Shared elements
- `data-vt-name="x"`: candidate name; assigned only if `x` exists in both old DOM and detached new DOM (one element per side; duplicates → name dropped + dev warning).
- `data-vt-class="card"`: `style.viewTransitionClass` (where supported) for grouped CSS (`::view-transition-group(*.card)`).
- Static names in author CSS also work (`.hero { view-transition-name: hero }`, Tailwind `[view-transition-name:hero]`); router does not touch them.

### Programmatic
```ts
router.navigate("/items/42", { transition: { types: ["zoom"] } }); // or transition: false
```

### Hooks
- DOM events on `document` (zero API surface, work from any `clientEvent`):
  - `rivet:navigate` (cancelable before `pushState`; `event.detail` = nav) — unsaved-changes guards.
  - `rivet:before-swap` (`detail` = nav + `transition` (ViewTransition | null) + `defer(promise)`; deferred promises capped at 500 ms, e.g. `img.decode()` of hero).
  - `rivet:after-swap` (DOM in, before animation ends), `rivet:navigated` (after `finished`, nav state idle).
- `onNavigate(fn)` from `@rivetjs/router/client` (SvelteKit-like): `fn(nav)` may return cleanup; register in `clientEffect` (resumable: recorded, runs at trigger).
```tsx
clientEffect(() => onNavigate((nav) => { if (nav.type === "back") closeDrawer(); }), { when: "load" });
```

### CSS (`@rivetjs/router/transitions.css`, opt-in import from app CSS; bundled by Vite → no inline styles)
```css
::view-transition-old(root), ::view-transition-new(root) { animation: none; } /* chrome stays still */
::view-transition { pointer-events: none; }       /* clicks reach the new DOM during animation */
::view-transition-group(rivet-page) { animation-duration: 200ms; }
html[data-rivet-transition~="back"]::view-transition-old(rivet-page) { animation-name: rivet-slide-out-right; }
/* … forward/back slide keyframes, fade default */
@media (prefers-reduced-motion: reduce) { ::view-transition-group(*) { animation: none !important; } }
```
- Tailwind v4 variants (`@rivetjs/router/tailwind.css`): `@custom-variant nav-pending (html[data-rivet-pending] &)`, `link-pending (&[data-rivet-pending])`, `nav-back (html[data-rivet-transition~=back] &)`.
  - `<a class="link-pending:opacity-60">`, `<div class="nav-pending:block hidden">` progress bar.
- VT pseudo-element animations stay plain CSS (Tailwind cannot target `::view-transition-*(name)` from element classes).

### Pending state
```tsx
import { useNavigation } from "@rivetjs/router/client";
const nav = useNavigation(); // accessor
<p hidden={nav().state === "idle"}>Loading {nav().location?.pathname}…</p>
```
- Shape: `{ state: "idle" | "loading" | "submitting", location: URL | null, from: URL | null, type, shown: boolean }`; `shown` = after `pending.delay`, held ≥ `minDuration`.
- `state: "submitting"` reserved for enhanced forms (later); progressive `<form method=post>` = full navigation.

## Navigation lifecycle (client)
1. Intent (`pointerover`/`focusin`): existing data + page-chunk prefetch; + `import()` of transitions module (when enabled).
2. Click (sync, existing `interceptClick`): dispatch cancelable `rivet:navigate`; `saveScroll()`; record history index (`history.state.i`) for direction; set `data-rivet-pending` on anchor; `router.navigate(url, { transition })`.
3. `pushState` + `href.set` (URL commits immediately, as today) → nav signal `{ state: "loading", location, from, type }`; start `pending.delay` / `skeleton.delay` timers.
4. Router `Async` rerun: previous generation aborted but kept mounted (hold); load = `Promise.all([routeData, loadPage(url), transitionsModule?])` with `work.signal`.
5. Outcomes:
   - redirect → `navigate(replace)`; this load never settles (existing) → step 3 again, `trigger: "redirect"`.
   - error → `_error`/`_404` view committed through the same swap (`types` + `error`).
   - newer navigation → abort (existing) → old page still mounted, timers reset, nothing animated.
6. Prepare: Async constructs the new branch detached (existing `wrap(factory)` before `move`); page renders synchronously (chunk loaded). Inner async boundaries commit their fallbacks (skeletons) inside it.
7. Swap decision (`transitions.ts`): VT iff `document.startViewTransition` && enabled && route/link not `false` && not reduced-motion-skip && `document.visibilityState === "visible"` && !popstate `hasUAVisualTransition` (native swipe already animated).
8. Before snapshot: names = intersection(`[data-vt-name]` old DOM, detached new); assign CSSOM `viewTransitionName` on old elements + routes region `rivet-page`; set `<html data-rivet-transition="push zoom">`; dispatch `rivet:before-swap`, await deferred (≤500 ms).
9. `startViewTransition({ update, types })` (callback form when `types` unsupported); `update` (sync):
   - dispose old branch, clear, insert new (`apply`);
   - assign names on new elements;
   - `document.title` from head; scroll: restore (traversal) / `#hash` / top; focus target/h1/`main` (`preventScroll`), not on traversal;
   - nav signal → `idle` (or held for `minDuration` of a shown indicator), remove `data-rivet-pending`, `aria-busy`;
   - dispatch `rivet:after-swap`.
10. `transition.finished` (or immediately without VT): clear CSSOM names + `<html data-rivet-transition>`; `rivet:navigated`; `onNavigate` cleanups of previous nav.
- Rapid navigation during animation: new `startViewTransition` skips the running one (spec behaviour); router also calls `skipTransition()` before step 8 → state consistent, final URL wins.
- `update` is synchronous → VT never freezes rendering on network (no 4 s timeout risk); snapshot cost ≈ 1–2 frames.
- Without VT: steps 8–10 minus snapshot; same events, same order.

## Runtime / codegen changes
- `Async` (`libs/runtime/dom.ts`): optional `swap?: (apply: () => void, next: DOMRange) => void` (default: call `apply`); optional `hold?: true` — rerun aborts work but disposes the previous branch inside `apply`, not at cleanup. Router passes both. No other `Async` users change.
- `Router` (`dom-router.ts`): `swap` prop; `navigate` gains `{ transition }` + history index in state (`{ rivet, i }`).
- `renderRoute`: forward `swap`/`hold`.
- Codegen (only when `transitions` enabled):
  - route `load` → `Promise.all([routeData(…), loadPage(match.url)])` (page renders sync; also fixes the blank frame for cold chunks — candidate for default even without transitions, see open questions);
  - `settle` moved from `render` into the swap (`update`), synchronous;
  - imports `transitions.ts` lazily (`import("@rivetjs/router/transitions")`), kicked on intent + navigation start;
  - wraps Router in `<Provider token={Navigation} …>`; route `transition`/`pending` exports read from loaded modules.
- New `libs/router/client/transitions.ts` (budget ≤ 1.2 KB brotli): swap decision, names, types, attributes, events, timers.
- Resume entry: `.rivet/entry.resume.ts` = `createResume({ contexts: [[Navigation, navigationSignal]] })` (server provides an idle constant; `{x: "rivet:navigation"}` revives to the browser signal).

## Pending UI details
- Global: `<html data-rivet-pending>` after `pending.delay`, removed ≥ `minDuration` after shown; `aria-busy="true"` on `[data-rivet-routes]` while loading (immediate).
- Progress bar: CSS-only recipe (`html[data-rivet-pending]::before` animated bar) in `transitions.css`; optional `<NavigationProgress/>` = `useNavigation` + `role="progressbar"` (indeterminate).
- Link: `data-rivet-pending` on the clicked anchor (not `aria-busy`: no AT meaning on links); cleared at commit/abort.
- Skeletons:
  - route-level: `export const pending` rendered in place of the old page only if load exceeds `skeleton.delay`, kept ≥ `skeleton.minDuration` (needs `Async` delayed fallback: `fallbackDelay`, `fallbackMin`). old → skeleton swap is instant; final swap animates skeleton → page.
  - in-page: existing `Async` / `lazyComponent` `fallback` (streaming on first load; on client nav committed with the page, resolved later without VT).
- Flash avoidance: indicators only after delay; swap never delayed for min-duration (only indicators/skeleton held).
- Optimistic (later, needs enhanced forms): `nav().formData` + `optimistic(source, (value, formData) => next)` → computed overlay until submission settles.

## Layout persistence + nested transitions
- Today: root layout persists; nested re-render.
- Phase 3 codegen: one outlet per layout depth; outlet `Async` keyed by `computed(() => layoutFileAt(depth, match), { equals })` → only the first changed depth and below re-render; each persisted layout's `data/params/url` signals updated per navigation (as root today).
- Transition target = outlet of the first changed depth: CSSOM name `rivet-page` goes there (deepest unchanged layouts stay out of the animation); `rivet-segment-<depth>` names available for per-depth CSS.
- Outlet wrappers must have a box (`view-transition-name` ignores `display: contents`): plain `<div data-rivet-outlet>`; documented.
- Names assigned only during transition: `view-transition-name` creates a stacking context/backdrop root; permanent naming would change `z-index`/`backdrop-filter` behaviour of page content.
- Keep-alive: no DOM keep-alive. Later: traversal data cache (`cache: { back: 5, maxAge }`) → instant back with stale data + revalidate.

## Browser support + fallbacks
| Feature | Chromium | Safari | Firefox | Fallback |
|---|---|---|---|---|
| same-document `startViewTransition` | 111 | 18 | 144 | instant swap, same events |
| `types` (`{ update, types }`, `:active-view-transition-type`) | 125 | 18.2 | verify at impl | callback form + `html[data-rivet-transition]` |
| `view-transition-class` | 125 | 18.2 | verify | `data-vt-class` ignored |
| cross-document `@view-transition { navigation: auto }`, `pagereveal`/`pageswap` | 126 / 123 | 18.2 | not shipped | normal navigation |
| `PopStateEvent.hasUAVisualTransition` | 123 | — (iOS swipe: assume true on gesture? verify) | — | treat as false |
- Feature detection only (`"startViewTransition" in document`, `typeof ViewTransition`, `CSS.supports("selector(:active-view-transition-type(a))")`); no UA sniffing.
- Docs: all styling via `html[data-rivet-transition]` works in every VT browser; `:active-view-transition-type` optional.
- Cross-document (MPA, static adapter, `data-rivet-reload`, no-JS, full loads): author CSS `@view-transition { navigation: auto; }` + static CSS names; Rivet ships recipe only. Phase 4 `crossDocument: true`: nonce'd/hashed `pagereveal`/`pageswap` script (≈300 B) applying `data-vt-name` intersection + direction from `navigation.activation` (Navigation API where available).
- Client router intercepts same-origin links → cross-doc rules never fire for them (no double animation).

## a11y
- Reduced motion: default `reducedMotion: "skip"` → no VT, instant swap (also skips snapshot cost); `"allow"` → CSS `@media (prefers-reduced-motion)` (included in `transitions.css`) shortens/removes animations.
- Focus: unchanged rules (target/h1/`main`, not on traversal), applied inside `update` → focus lands on real DOM; VT pseudo layer is not in the a11y tree.
- Announcement: focus on h1 announces route; optional polite live region `[data-rivet-announcer]` with `document.title` for apps without h1 (phase 2).
- Pending: `aria-busy` on routes region while loading; progress bar `role="progressbar"` + `aria-label`; no live-region spam for fast navs (delay).
- `::view-transition { pointer-events: none }` → input during animation reaches new DOM; animations ≤ 250 ms default.
- No content hidden by transitions: names cleared on `finished`; skipped transitions leave final DOM.

## CSP / Trusted Types
- No inline `style` attributes, no `<style>` injection: names/classes via CSSOM (`el.style.viewTransitionName = …`), which `style-src` without `'unsafe-inline'` does not block.
- Stylesheets: package CSS files bundled by Vite (external `<link>`).
- Scripts: transitions module loads via `import()` from nonce'd loader (`'strict-dynamic'`); static pages: `'self'`. Phase 4 cross-doc script: inline with nonce (server) / included in `hashCSP` (static).
- Trusted Types: no HTML/script sinks used.
- Test with stricter policy than default: `style-src 'self'` added → zero `securitypolicyviolation`.

## Zero cost
- `transitions` unset → `app.tsx` / `entry.server.tsx` byte-identical to today (codegen snapshot test); `@rivetjs/router/transitions` never in graph.
- Enabled: 0 bytes before first navigation intent (dynamic import); App chunk grows only by the `Promise.all` + Provider lines (budget +150 B brotli).
- SSR: unchanged HTML except `Navigation` context entry when a page reads `useNavigation()` (state table only); no per-request work otherwise. `apps/ssr-bench` does not use `@rivetjs/router` → bench unaffected; verify with existing bench run.
- Runtime `Async` additions: two optional props, no cost on the non-router path (branch on `props.swap` once per commit); `libs/runtime` size budget +80 B brotli.
- No `startViewTransition` when disabled, reduced motion (skip) or unsupported.

## Testing (Playwright, node:test style as `libs/router/tests/app.test.ts`, `apps/playground/tests/resume.test.ts`)
- Unit: codegen snapshots (off = identical; on = `Promise.all`, Provider, lazy import); name intersection (dupes, missing side); types merge precedence; direction from history index; timer logic (fake clock: delay/min, abort resets).
- Chromium:
  - one `startViewTransition` per nav (spy via `addInitScript`), expected `types` for push/back/forward/replace/link/route;
  - shared element: list → detail → back; `getAnimations()` on `::view-transition-group(item-42)` present; only intersected names set; names cleared after `finished`;
  - cold page chunk: single DOM swap (MutationObserver: one replacement of routes region), no blank frame;
  - rapid nav (A→B→C before B resolves; and C during B's animation): final DOM/URL = C, one committed swap per settled nav, no errors;
  - old page live while pending (counter on old page increments during throttled load);
  - scroll restore on back + focus target after `finished`; hash nav;
  - `emulateMedia({ reducedMotion: "reduce" })` → no VT call;
  - `delete Document.prototype.startViewTransition` → instant swap, all events fire in order;
  - pending: throttled data route → `aria-busy` immediate, `html[data-rivet-pending]` after delay, held ≥ min; fast route (< delay) → never set; skeleton after `skeleton.delay`;
  - `useNavigation()` in resumed root layout updates without layout component running (`__componentRuns` unset);
  - network: no transitions chunk before first intent; 0 extra requests on load;
  - CSP: strict nonce policy + `style-src 'self'` + Trusted Types → zero violations through nav/back/skeleton;
  - redirect during client nav animates into the target once; error route uses swap.
- WebKit + Firefox projects: same-doc smoke (VT where supported, fallback otherwise); Firefox cross-doc absent → plain navigation.
- Static adapter (Chromium): `@view-transition` recipe → `pagereveal` `event.viewTransition` non-null between prerendered pages.
- Size checks: transitions module ≤ 1.2 KB, App delta ≤ 150 B, runtime delta ≤ 80 B (brotli), in existing size test style.

## Phases
1. P0 runtime groundwork: `Async` `swap`/`hold`; Router `swap` prop; codegen awaits page chunk with data; synchronous `settle` at commit. No visible API; fixes cold-chunk blank frame.
2. P1 same-document VT: `transitions` config, lazy `transitions.ts`, types/direction/attribute, route `transition` export, `data-transition`, `data-vt-name`/`data-vt-class`, reduced motion, events, `onNavigate`, `transitions.css`.
3. P2 pending UI: `Navigation` context + resume entry, `useNavigation`, html/region/link attributes, delay/min, route `pending` skeleton (`Async` delayed fallback), Tailwind variants, announcer.
4. P3 nested outlets: persistent nested layouts, per-depth transition target.
5. P4 cross-document + extras: `@view-transition` recipe/docs, opt-in `pagereveal` names script, traversal data cache, optimistic helpers (after enhanced forms).

## Open questions (recommended answer first)
1. Default on/off? → opt-in `transitions: true` (behaviour + bytes are visible changes). Alt: on by default like Qwik/Astro.
2. Reduced motion → `"skip"` (no VT at all) default; `"allow"` defers to CSS. Alt: always run VT, CSS removes motion (keeps crossfade).
3. Type styling hook → both `types` and `html[data-rivet-transition]`, docs lead with the attribute (works in every VT browser). Alt: `types` only (cleaner, loses Chrome 111–124 / partial Firefox).
4. Shared-element naming → `data-vt-name` + old/new intersection via CSSOM. Alt: `viewTransitionName` JSX prop compiled to inline style (breaks strict `style-src`), `view-transition-name: match-element` (same-doc only, no cross-route identity), Remix-style `useViewTransitionState` (needs component code).
5. Keep old page live until swap (`hold`) → yes for Router. Alt: current inert old page (simpler, but pending UI on old page and old handlers break).
6. URL commit timing → keep immediate `pushState` (current; abort semantics simple; pending link + `aria-busy` signal the wait). Alt: commit URL at swap (React Router/Next) — needs router `href` decoupled from history.
7. Await page chunk with data even without transitions → yes, make P0 default (removes double paint; no byte cost). Alt: only when `transitions` enabled.
8. Indicator / skeleton defaults → indicator delay 200 / min 300 ms; skeleton delay 1000 / min 500 ms (TanStack). Alt: single setting for both.
9. Default animation → page-region fade 200 ms, root static, slide only with `forward`/`back` types in CSS opt-in classes. Alt: whole-document crossfade (browser default).
10. `<Link>` component → no; plain `<a>` + data attributes (resumable, no JS). Alt: typed `<Link transition pending>` wrapper.
11. JS hooks → DOM events + `onNavigate`; no hooks file. Alt: `src/navigation.client.ts` app hooks module loaded with transitions chunk.
12. Cross-document named elements → phase 4 opt-in script; until then static CSS names only. Alt: never (CSS only).
13. Keep-alive → no DOM keep-alive; traversal data cache later. Alt: `keepAlive` per route (detached branch, paused effects).


## Decisions — open questions resolved (user, 2026-10-03)
Unpicked questions take the recommended answer.
- route-transitions-1 · On by default?: Opt-in (transitions: true) — No surprise behavior or bytes; users enable it explicitly.
- route-transitions-2 · Reduced motion handling: Skip transitions entirely (default) — Safest; an 'allow' option leaves it to the app's CSS.
- route-transitions-3 · Styling hook: Both types and an html attribute — Docs lead with html[data-rivet-transition], which works in every browser with transitions.
- route-transitions-4 · Shared-element naming: data-vt-name attribute — Matches old/new elements by name; no inline styles, works with strict CSP.
- route-transitions-5 · Keep old page live: Yes, keep it live until swap — Pending UI on the old page works and handlers keep responding.
- route-transitions-6 · When URL changes: Update immediately (current) — Simple cancel behavior; pending link and aria-busy show the wait.
- route-transitions-7 · Await page code always: Yes, make it the default — Removes the double paint for everyone; no extra bytes.
- route-transitions-8 · Loading indicator timing: Separate indicator and skeleton timings — Indicator: wait 200 ms, show ≥300 ms; skeleton: wait 1000 ms, show ≥500 ms.
- route-transitions-9 · Default animation: Fade page area 200 ms, layout static — Slides only via opt-in CSS classes for forward/back.
- route-transitions-10 · Link component: Typed `<Link transition pending>` component (user pick b). Shared with language-service Q4: one `<Link>` with typed `to`, prefetch control, transition, pending state.
- route-transitions-11 · JavaScript hooks: DOM events + onNavigate — Uses standard events; no extra file convention.
- route-transitions-12 · Cross-page named elements: Opt-in script in phase 4 — Static CSS names only until then.
- route-transitions-13 · Keep pages alive: No DOM keep-alive; data cache later — Back navigation re-renders; cached data added in a later phase.

## Implementation notes (P0, P1, P2 core, `<Link>`)
- Plan: [route transitions plan](../plans/2026-10-03-route-transitions.md). E2E: `libs/router/tests/transitions.test.ts` (fixture `libs/router/tests/fixture-transitions`).
- **`RoutePath` (shared with the language service, its Q4):** `.rivet/routes.d.ts` augments `interface RouteRegistry { path: … }` in `@rivetjs/router`; exported types:
  - `RoutePath` = `RouteRegistry["path"]` (`"/" | \`/items/${string}\` | …`), `string` when `routes.d.ts` is not in the program.
  - `LinkHref` = `RoutePath | \`${RoutePath}?${string}\` | \`${RoutePath}#${string}\`` — type of `<Link to>`.
  - Page routes only (no endpoint routes); params and splats → `${string}`; static segments decoded (as authors type them), `` ` `` / `\` / `${` escaped; optional segments → one member per expansion.
  - Language-service diagnostics should reuse `RoutePath` / `LinkHref` (no second route union).
- **`<Link>`** = `@rivetjs/router/link` (`client/link.tsx`, not a resume module): plain `<a href>`; props → attributes the delegated router handlers read: `transition` → `data-transition` (`false` → `none`), `prefetch="none"` → `data-rivet-prefetch="none"`, `pending` → `data-rivet-pending-class`, `replace` → `data-rivet-replace`, `reload` → `data-rivet-reload`; plus `class id title rel target aria-label aria-current`. No spread (compiler has no spread attributes). Plain `<a>` with the same attributes behaves identically.
- Exported as `Link` from `@rivetjs/router/client` (the language service keys `<Link to>` checks off it) and `@rivetjs/router/link`; not from `@rivetjs/router` (`index.ts` is loaded by Node code, e.g. `@rivetjs/i18n`; `.tsx` would not run). Pure transition helpers sit in `client/transition-helpers.ts` for Node unit tests.
- **Runtime:** `Async` `hold` (committed branch owned by the boundary owner, disposed inside `apply`; no fallback once something committed) + `swap(apply, next: ParentNode)` (detached fragment; stale `apply` discards). `Router` `swap` / `hold?: () => DOMValue` (first-generation placeholder; server `Router` ignores both, so no streaming boundary appears). `lazyComponent(...).load()` (browser) readies the component so routes render synchronously — before, a page's first render always went through an inner `Async` (one microtask later; shared elements and `settle` missed it).
- `dom-resume`: signals provided as identified contexts arm their bindings (`useNavigation()` regions in resumed layouts).
- **Codegen (always, decision 7):** load = `Promise.all([routeData, loadPage(url)])`; modules table → `preloadPage(PageN, loadPageN)`; `settle` out of `render` into `swapRoute` (synchronous after `apply`; rAF retry only when no heading yet); `hold={heldRoutes}`: a resumed page's first navigation moves the server-rendered route nodes into the router's first view, so the region never blanks (they are inert: their resumed region is disposed); intent skips `data-rivet-prefetch="none"`; popstate passes the event (`hasUAVisualTransition`).
- **Codegen (`transitions`):** `const transitions = () => import("@rivetjs/router/transitions").then((m) => m.install(options))` (browser only), kicked on intent and awaited in route load; `_routeModule(page)` hands the page's `transition` export to the swap; server entry wraps App in `<Provider token={Navigation} value={navigation}>`; `.rivet/entry.resume.ts` = `createResume({ contexts: [[Navigation, navigation]] })`, set as `resume.entry` unless the app has its own (then it must add the pair).
- Navigation records live in `client/index.ts` (always loaded): `rivet:navigate` (cancelable, links), `onNavigate` (fires for every app; after-functions run once the page is in), direction from `history.state.i` (numbered by `go()` after each push/replace; scroll key kept).
- `client/navigation.ts` (`@rivetjs/router/navigation`): `Navigation` context (id `rivet:navigation`, default = browser signal, so CSR/dev work without a provider) + `navigation` signal + `IDLE`.
- Pending: indicator timer keeps running across a redirect / newer click (no flash); `state` stays `loading` + `shown` until the min duration ends; fast navigations never set `html[data-rivet-pending]`.
- Types: `[type, ...(link data-transition ?? route types)]`; link `none` or route `false` (without link types) → instant swap. Callback form fallback when `{ update, types }` throws (Chrome < 125).
- `rivet:before-swap` detail has `animate: boolean` (not a `ViewTransition`: the transition starts after deferred work); deferred capped at 500 ms.
- Title still set by `routeData` at data time (before the snapshot), not inside `update`.
- Sizes (fixture build, brotli): transitions chunk 1404 B (budget 1.2 KB: over by ~200 B), navigation 138 B, link 347 B. Runtime (minified, rolldown gate): `dom` +226 B, `router/dom` +197 B, `dom-resume` +87 B.
- Deferred: route `export const pending` skeleton (`Async` `fallbackDelay`/`fallbackMin`), announcer, nested outlets (P3), cross-document (P4), programmatic `navigate(to, { transition })` (resumed apps have no router reference outside handlers), layout `transition` exports (pages only), WebKit/Firefox projects, static-adapter cross-doc test.
