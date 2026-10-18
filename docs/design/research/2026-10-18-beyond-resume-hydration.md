# Beyond resume and hydration — what the field complains about, five rounds of alternatives, and the model that falls out (2026-10-18)

- Status: research + design record, lane RESUME-V2 round 2 (user: "why delete? go a few rounds; see what Qwik / Solid / React / Next / Astro / Vue developers complain about; think beyond resumability and hydration"). No code.
- Outcome: the earlier proposal (`../specs/2026-10-18-structural-resume-design.md`, "structural resume") survives as **one layer** of a wider model, not as the model. The answer to "why delete serialized resume" changes: it is not deleted, it is **re-scoped** to an explicit per-value escape hatch, because every capability it has is covered more cheaply by a layer below it — and the user is right that a one-lane ceiling measurement is not enough to delete a subsystem. §6 keeps the deletion question open until the spikes in §8 answer it.
- Reading order: §1 complaints (evidence), §2 the invariant they share, §3–§5 the rounds, §6 the model ("derived client"), §7 what it does for the three axes, §8 spikes, §9 rulings.

## 1. What developers of each framework complain about (2025–2026)

Sources are blog posts, GitHub issues, release notes and the State of JS 2025 survey; none is a controlled study. The pattern across them is what matters, not any single claim. Links in §10.

| Framework | Recurring complaint | What it is really about |
| --- | --- | --- |
| **Qwik** (serialized resume) | state must be serializable (no class instances, streams, cycles); optimizer warnings for non-capturable dependencies; `$` boundaries take weeks to internalise; production builds 1–2 min on medium projects because the optimizer analyses every lazy boundary; "bloated HTML" and state you expected to be live coming back inert; Qwik 2 RC removed its ~60 HTML comment markers per page to 0 because they needed one ordered write pass, cost CPU and memory and blocked out-of-order streaming — JS before startup shrank, total bundle grew | the cost of describing a closure graph per request, and of asking the author where the graph may be cut |
| **React / Next** (hydration + RSC) | hydration mismatch is the first-week experience (browser-only reads, time, random, `typeof window` branches); React 19 discards the server HTML from the nearest Suspense boundary and re-renders (flicker, broken forms, a11y regressions); `"use client"` placed at a layout turns the subtree into client code silently; four interacting cache layers nobody can predict, then replaced wholesale by `"use cache"`; satisfaction falling in State of JS 2025 while usage stays ~60–70 %; cache-poisoning / RCE advisories tied to the rendering pipeline | two executions that must agree; author-placed seams; caching semantics bolted onto rendering |
| **Astro** (islands) | islands cannot share state (no context across roots) → nano stores; `.astro` components cannot be interactive at all; `client:load` everywhere ships an SPA's worth of JS; server islands = an extra request per personalised fragment | hand-drawn boundaries; two runtimes (static template vs framework island) |
| **Vue / Nuxt** | hydration node mismatch (silent in production, "ships for weeks"); Vapor SFCs currently fall back to plain SSR | same seam as React |
| **Solid / SolidStart** | hydration errors per added route, with node_modules components, with `props.children` reads; islands shelved (`experimental.islands` accepts only `false`); Solid 2.0 keeps every expression that feeds the client as an open binding for the life of the response and re-sends values as promises settle (Seroval) — async in the graph, still hydration | same seam, plus async coordination |
| **Svelte 5** | +18 % HTML from hydration markers (25 markers where Svelte 4 had one per component) on a size-capped CMS; mismatches under adapter-static; `$effect` not running on the server → mismatch; `hydratable()` added to avoid running the same async work twice (and a CVE in it) | markers as bytes; double execution of async |
| **LiveView / Datastar / HTMX** (server-driven) | 300 ms+ round trips far from the server; nothing works offline; a process + heap per connected client; no optimistic UI → Alpine bolted on | the seam moved to the network |
| **Platform** (not a framework) | invoker commands (`command` / `commandfor`) are Baseline since Safari 26.2: dialogs and popovers with no JS; speculation-rules prerender: p75 LCP 320 ms vs 1,800 ms on the same sites; cross-document view transitions in CSS; compression dictionaries (RFC 9842, Chrome 130+): Google Search HTML −23 % vs brotli, Cloudflare passthrough in beta | the platform now covers interactions and navigations frameworks used to own |
| **State of JS 2025** | top pain points: complexity, architecture, state management, performance; React and Next are what front-end developers "struggle with" most | the seam again |

Observation: **every complaint is about the server/client seam** — (a) two executions that must agree, (b) limits on what can cross, (c) the author being asked where to cut, (d) async done twice, (e) bytes spent describing the seam (markers, state), (f) caching layered over rendering. The frameworks differ in *where* they put the seam (Qwik: per closure; React: per `"use client"`; Astro: per island; LiveView: at the socket) and in *who* pays (server CPU, client CPU, author, bytes). None removes it.

Rivet today sits in the Qwik column with better numbers (SSR 17× Qwik's CPU/page, TTFB WIN, navigation 2.1×), and inherits the same column's complaints: a 250-line serializability rulebook, Function Bridge, markers and state in the HTML, and region re-creation (the React "discard and re-render" failure, silent).

## 2. The invariant, restated

For one interaction the browser needs the handler's code, the state it reads and writes, the DOM edits that state change implies, and nothing else. Every model either **ships a description of that** (serialized resume: structure + values per request) or **recomputes it** (hydration: run the page). The third option, which no shipping framework takes as its default, is to **derive it at compile time**: the compiler already knows, for every JSX expression, which signals it reads and which DOM node it writes — that is what fine-grained compilation *is*. What stops frameworks from using that knowledge on the server-rendered page is that the knowledge is expressed as *code that must run* (an effect created inside a component body), so they either run the body (hydrate) or serialize the result of having run it (resume).

The rounds below are attempts to use that knowledge without running the body and without serializing the run.

## 3. Round 1 — candidates (deliberately wide)

| # | Model | One-line mechanism | Removes | Keeps / adds |
| --- | --- | --- | --- | --- |
| A | **Structural resume** (earlier spec) | values only on the wire; boundary spine runs once in adopt mode on first touch | closure serialization, rulebook, per-site records | a second execution that must agree with the HTML (loud, not silent); spine CPU on first touch |
| B | **Derived client** (sliced interactions) | the compiler emits, per interaction site, a standalone program: find the element by its compiled path, read state from a tiny value overlay (or the DOM itself where the binding is invertible), run the handler, apply the statically known DOM edits. No component ever runs; no reactive graph is built; no run is serialized | the seam itself for every site whose dependencies are provable: nothing executes twice, nothing describes the run | needs a fallback for sites whose dependencies the compiler cannot prove (library widgets, dynamic props): that fallback is A |
| C | **Platform-native lowering** | `Show` toggles, dialogs, popovers, tabs, accordions, menus lowered to `command` / `commandfor`, `popover`, `<details>`, `<dialog>`, `:has()` state, CSS-only transitions where semantics match | JS for the most common interactions entirely | a11y parity audit per lowering; cdk already owns these semantics so the lowering has a spec to match |
| D | **MPA-first navigation** | client router off by default: speculation-rules prerender (hover / viewport), cross-document view transitions, bfcache; Rivet's 0.3–0.5 ms renders + route cache make every navigation a cheap document | the 4 requests / 15.6 KB before input every router page pays today; the "loader must own link interception" gap; the client-side cache layers that Next users hate | client router as opt-in for apps that need state to survive navigation (editors, players); Firefox / Safari prerender gaps fall back to a plain navigation, which is still fast |
| E | **Optimistic server actions** | every data mutation is a server action returning a live-page patch (exists: partial render / `live` pages); the derived slice applies the same edit locally first; the patch confirms or morphs | client-side data state management for most apps; LiveView's latency and per-connection memory (stateless requests) | conflict policy per action; offline = queue |
| F | **DOM as the value store** | a signal whose only consumer is an invertible text / attribute binding has no shipped value: the slice reads it back from the DOM | shipped values for the common `count`-in-an-`<output>` case | only where invertible; formatting kills it; subsumed into B's "value location" rule |
| G | **Transport** | dictionary-compressed HTML (per-route dictionary) and chunks (delta against the previous deploy), Early Hints for the route chunk | bytes on the wire (Google: −23 % HTML) | infra; orthogonal; already on the roadmap as DICT-COMPRESS |

A–B are rendering models; C–G are stances that reduce how much A/B must do. Rounds 2–4 are about B.

## 4. Round 2 — can B actually be built? (the hard questions)

**Q1. How does the client find the handler for a click without `data-r` ids and without running the component?**
The compiled DOM template already walks `firstChild` / `nextSibling` to each site; that walk is a *path*. Emit, per site, its path from the nearest **structural anchor** (boundary root, `For` row start marker, `Show` branch marker). The loader resolves the event target to the nearest anchor (walk up to a `data-b` root or marker pair — the markers already exist for rows and branches), computes the target's path relative to it, and looks the site up in the route's site table. Cost: one upward walk per event; no per-element attribute; markers only at structural choice points (what Qwik 2 kept after removing its 60 per-page comments).

**Q2. Where do the handler's captures come from, if the body never ran?**
Classify every body local a site captures (the compiler has this list today — it is what `_rFn` serializes):
1. keyed signal / store created in the body → the **value overlay** (per page: `(boundary id, ordinal) → value`, JSON, tiny) — or the DOM itself when the signal's only consumers are invertible bindings (F);
2. a prop → the boundary's props record (data) or, for a getter prop, the parent's expression — resolvable statically when the call site is static (the compiler has cross-module facts already; `has_site_within`, `staticComponents`);
3. a pure derivation of 1–2 (`const total = items.reduce(…)`) → a **capture recipe**: recompute from its inputs at first touch (today's `{f}` / `_rFn` recipe mechanism, re-purposed: never serialized, always recomputed);
4. a local function → in the slice's chunk (it is code);
5. a library object (`createSelectState(…)`) or anything the compiler cannot classify → **not sliceable**: the site falls to layer A (adopt the boundary).
Serialized resume's one extra capability — "serialize the *value* of an expensive, non-derivable, non-DOM derivation" — becomes an explicit escape hatch (`serialize(expr)`), not a default.

**Q3. Which bindings does a write touch?**
Static readers: every expression that reads the signal syntactically (`count()`, `selected() === row().id`) inside the same compile unit — the compiler emits the per-signal **edit list** (site, writer). Cross-component readers through static props → the same, through the call site. Readers the compiler cannot see (a signal passed into a library, a computed built by a helper) → the site that reads it is layer A anyway, and the signal's server-recorded **wake list** (boundaries that read it, one `Set` per keyed signal — from the earlier spec) materialises that boundary on the first write. Rule: a signal is *fully static* iff every reader is static; a write to it never loads the DOM runtime. Otherwise the slice writes the keyed signal and the wake list does the rest.

**Q4. Lists and branches.**
A `For` whose rows hold sliced sites: row index from the row marker; item = `items[i]` from the overlay (loader data is already there as one JSON tree). Per-row edits are the row's writer with `i` as a parameter — one function for 1,000 rows, no per-row record. Reconciliation (filter, insert, remove) needs creation → the **rendered** layer (today's `_for` / `_tpl`, loaded on demand); adoption of the existing rows is O(1) by markers. `Show` / `Switch`: branch key from the marker; switching branches = creation → rendered layer.

**Q5. What is in the browser before and after the first click, for a page of application components?**
Before: inline loader (budget ≤ 1 KB br). On the click: the route's slice chunk (handlers + edit lists + recipes; hundreds of bytes to a few KB) and the overlay (inline). **No framework runtime** unless a site needs the adopted or rendered layer — then `@rivetjs/reactivity` + `dom` + adopt load on demand. The counter example's first click goes from 4 requests / 19.5 KB br to one chunk of ~0.3 KB; the resume-bench fixture's row click to the slice chunk only. This is below Qwik (qwikloader + core on first event) and below any hydrating framework's runtime.

**Q6. Does B have a seam?**
No execution happens twice: the server runs the program once and writes HTML + values; the client runs *derived* programs that start from those values. A server value that is non-deterministic (time, random, request data) is simply the value in the overlay or the DOM — **no determinism contract** for sliced sites (that contract only applies to the adopted layer, where a body re-runs). The one way to mismatch is a compiler bug (an edit list that misses a reader), caught by the existing resume-fuzz oracle (resumed page vs CSR page must converge), which becomes the correctness gate for the derivation rather than for the rulebook.

**Q7. Compile cost (Qwik's 1–2 min builds).**
Per-module work is the same analysis the DOM lowering already does (reads per expression, paths per site); cross-component resolution is a fixpoint over module facts like `staticComponents`. The Rust compiler is the asset here; no whole-program bundler pass is needed beyond the facts the Vite plugin already gathers.

## 5. Round 3 — critique, and round 4 — what survives

Against B:
- **Soundness of the dependency analysis.** Aliasing (`const s = { count }; … s.count()`), signals stored in arrays, reads behind `untrack`, reads inside a helper that receives the signal: the analysis must classify every read it cannot see as *unknown* and demote the site to the adopted layer. Narrow member captures (Function Bridge T11) already do a version of this classification; it moves from "what to serialize" to "which layer". Conservative by construction: an unknown read costs a layer, never correctness.
- **Two client code paths must agree** (derived writers vs rendered templates). They are generated from one IR by one compiler; the fuzz oracle compares them on every story route. This is strictly fewer paths than today (server resume target, DOM target, resume symbols, adopt).
- **Generated size on big pages.** Edit lists are per signal, not per instance; row writers are parameterised; a route's slice chunk should be smaller than today's symbol chunks because captures are not re-exported per symbol. Measured at the gate.
- **Library widgets stay on the adopted layer.** cdk collections, overlays, date pickers, anything with `mergeProps` / refs / effects: the adopt run of the earlier spec. Their cost profile is the earlier spec's (state 3.3 KB → ~0.2 KB, one adopt run on first open, measured at S3). They never get a rulebook: a widget author writes plain JS.
- **It is more compiler.** Yes. That is the thesis: the seam is the compiler's problem. The alternative (every author managing `$` / `"use client"` / `client:*`) is what §1 shows people leaving.

Against A alone (the earlier spec): it still re-runs component bodies on first touch and therefore still has a determinism contract and spine CPU. B removes both for every site it can prove, and A only pays where B cannot.

Against keeping serialized resume as a default: §4 Q2 shows each of its capture kinds is covered — signals by the overlay, props by records, derivations by recipes, functions by code, library objects by adoption. What it uniquely offers is serializing a *computed value* instead of recomputing it; that is a per-value decision an author can make explicitly, not a page-wide mode worth 100 KB of runtime source and a rulebook. **Not deleted; demoted to `serialize(expr)`.** The deletion of the *machinery* waits for S2 (§8).

What survives into the model:
- **Four layers, chosen per site by the compiler, reported to the author**: native (C) → derived (B) → adopted (A) → rendered (today's DOM target). Each layer loads nothing the one below needs.
- **Values only on the wire** (A's wire format) for every layer: overlay + loader data + boundary records; markers only at structural choice points.
- **MPA-first navigation (D)** and **optimistic server actions (E)** as the default data / navigation stances; the client router becomes opt-in.
- **Transport (G)** as infrastructure.

## 6. The model: derived client

Name: **derived client** — the browser program is derived from the server program by the compiler; it never re-executes it and never receives a description of its execution.

| Layer | Who decides | What ships | What runs on first touch | Falls back to |
| --- | --- | --- | --- | --- |
| **native** | compiler (semantic match + a11y parity table) | HTML attributes (`command`, `popover`, `<details>`), CSS | nothing | derived |
| **derived** | compiler (all reads of the site provable) | route slice chunk: handler, edit list, recipes, site paths; overlay values | the slice: ≈ vanilla JS, no runtime | adopted |
| **adopted** | compiler (unknown reads, library widgets, effects, islands) | boundary record + keyed values; the component's DOM chunk | one adopt run of the boundary spine (earlier spec §3) | rendered |
| **rendered** | runtime (new content: rows, branches, lazy routes) | DOM runtime | normal client creation | — |

Non-negotiables carried over from Rivet's current claims, now stated per layer:
- Nothing executes before the first input on any layer (fetch-ahead at idle only).
- The native and derived layers have **no determinism contract**: the HTML is the truth.
- The adopted layer's contract is loud (dev verifier), never silent.
- One wire format (values), one compiler IR, one fuzz oracle for all layers.
- Authors never mark a seam. They get a per-page **interaction map** (devtools + `check-examples`): layer per site, bytes, why a site is not on a cheaper layer ("adopted: `state` is a library object"), the same way bundle analyzers show weight.

How the three questions the user asked resolve:

1. **SSR speed** — resumable render = static render + value capture on every layer (bound ≈ 1.1–1.3× static; today 3–7×). The server does strictly less than today for every layer, and nothing extra for the derived one (slice tables are build output).
2. **SSR resources** — memory ≈ static (no recorder graph); HTML = static HTML + overlay + structural markers (+ fewer bytes than Solid's keys or Svelte 5's markers); route cache, dictionaries and Early Hints stack on top.
3. **Client** — JS before input 0 evaluated, ≤ 3 requests fetched at idle (route slice, route component chunk for adopted widgets, shared); first interaction on application pages runs vanilla-sized code with no runtime; widget pages pay one adopt run; LCP / FCP see smaller HTML and a ≤ 1 KB loader; TBT 0; INP bounded by the slice (derived) or the adopt run (adopted), both measured.

## 7. What this does to each complaint in §1

| Complaint | Derived client |
| --- | --- |
| serializability limits, `$` rulebook (Qwik, Rivet) | nothing serializes but values; library objects are recomputed or adopted; authors write plain JS |
| hydration mismatch, discard-and-re-render (React, Vue, Solid, Svelte) | derived sites cannot mismatch (no second execution); adopted sites report loudly in dev |
| `"use client"` / `client:*` placement | no author-placed seams; the interaction map shows the compiler's choice and why |
| islands cannot share state (Astro) | one reactive overlay per page; a widget and a page component share keyed signals by key |
| markers and state bloat (Qwik 1, Svelte 5, Rivet) | markers only at structural choice points; values only |
| caching layered over rendering (Next) | MPA-first + route cache: the cache is HTTP, keyed by URL, with ETag / SWR / tags (ROUTE-CACHE, exists) |
| double async work (Svelte `hydratable`, Solid 2 open bindings) | the server's value is the value; nothing refetches on the client until the user acts |
| server-driven latency / offline / per-connection memory (LiveView) | optimistic derived edit first, stateless action patch second |
| build time (Qwik) | per-module facts + fixpoint in the Rust compiler; no bundler-level whole-program pass |

## 8. Spikes (replace §7 of the earlier spec)

| Spike | What | Pass |
| --- | --- | --- |
| **S1 server bound** (unchanged) | hand-lower the ssr-bench `/resume` page + the ui dashboard to the values-only server shape; CPU / page, RSS, HTML bytes vs HEAD resume and static | ≥ 2× CPU vs HEAD resume; HTML ≤ Solid hydratable at 1000 rows |
| **S2 derived slices** (new, the decisive one) | hand-write the resume-bench fixture's client as derived slices (counter, toggle region, row click, filter via `_for` adoption + rendered reconcile, navigate via a lazy route chunk, scroll client event, visible canvas effect) + a ≤ 1 KB loader + the overlay; run `apps/resume-bench` all scenarios, Slow 4G + 4× CPU, against HEAD Rivet, Qwik 2, Solid 2 | `jsBytesBeforeInteraction` ≤ Solid stable (8.3 KB) and `documentBytes` ≤ Solid (7.1 KB); paint latency ≤ HEAD on every scenario, WIN (≥ 1.3×) on `click` / `keyClick` / `hoverClick` first-DOM-mutation `latency` (today 15.3 vs Solid 6.5 ms) |
| **S3 adopted widgets** | hand-written adopt runtime for the dashboard showcase + cdk Select; first-open cost at 4× CPU; state bytes | first open ≤ HEAD + one frame; state −80 % |
| **S4 native lowering audit** | table of cdk / ui interactions that lower to `command` / `popover` / `<details>` with a11y parity (focus, Escape, inert, announcements) | per-row verdict; ships only rows with parity |
| **S5 route bundles** | one slice chunk + one component chunk per route, shared ≥ 2 routes, fetch-ahead at idle | ≤ 3 requests before input on ui-docs frames, bridge-demo, starters |

S2 is cheap (one fixture, hand-written) and answers the model question: if a hand-derived vanilla program does not beat today's resume and Solid on that fixture, the derived layer is not worth a compiler. S1 + S3 answer the server and widget questions. Only then compiler work.

## 9. Rulings (supersede R1–R4 of the earlier spec)

- **R1′ — model.** Derived client with four compiler-chosen layers; serialized resume's machinery stays until S2 is measured, then is either deleted or kept as the implementation of `serialize(expr)`. Recommendation: decide after S2, not before.
- **R2′ — word.** Keep "resumable" (the native + derived layers are resumability in Qwik's own definition — pause on the server, continue in the browser without replaying — minus the serialization), add "derived" to the vocabulary; drop "no hydration" as a slogan.
- **R3′ — stances.** MPA-first navigation as the starter default (client router opt-in); optimistic server actions as the data default. These are independent of the rendering model and can be measured on editorial-bench / resume-bench now.
- **R4′ — order.** S2 first (one week, one fixture), S1 in parallel, S3–S5 after. Pause Function Bridge T22–T29, lazy-state, ROW-ABI, RESUME-ROWS-REMOVE, DOM-EMIT resume rows until S2 reports.

## 10. Sources

Qwik: [Qwik 2.0 RC: JavaScript streaming without the overhead](https://next.qwik.dev/blog/qwik-2-rc/), [what changed in Qwik 2.0 RC (markers 60 → 0)](https://dev.classmethod.jp/en/articles/qwik-2-rc-changes/), [Qwik in production: resumable and cheap](https://jacar.es/en/qwik-in-production-resumable-and-cheap-on-the-client/), [Resumable (docs)](https://qwik.dev/docs/concepts/resumable/), [Qwik Resumable Framework rules](https://agentpedia.codes/rules/frontend-frameworks/qwik-resumable-framework), [core 2.0.0-rc.3 release](https://github.com/QwikDev/qwik/releases/tag/%40qwik.dev/core%402.0.0-rc.3).
React / Next: [Next.js hydration errors in 2026](https://medium.com/@blogs-world/next-js-hydration-errors-in-2026-the-real-causes-fixes-and-prevention-checklist-4a8304d53702), [RSC in 2026: patterns, pitfalls](https://dev.to/jsmanifest/react-server-components-in-2026-patterns-pitfalls-and-when-to-actually-use-them-fhi), [eufemia #9718 hydration](https://github.com/dnbexperience/eufemia/issues/9718), [Next.js discussion #35773](https://github.com/vercel/next.js/discussions/35773), [RSC mental model and the use client boundary](https://umesh-malik.com/blog/react-server-components-guide), [Caching in next.js: gift or curse](https://alexdln.com/blog/caching-in-nextjs-gift-or-curse), [Next.js in 2026: practitioner take](https://nayankyada.com/blog/nextjs-in-2026-honest-practitioner-take-on-whats-working-and-what-isnt), [Next.js liability / sentiment 2026](https://www.buildmvpfast.com/blog/nextjs-liability-framework-sentiment-developer-frustration-2026), [Product Hunt reviews](https://www.producthunt.com/products/nextjs/reviews).
Astro: [Share state between islands](https://docs.astro.build/en/recipes/sharing-state-islands/), [Navigating islands of interactivity](https://gitnation.com/contents/navigating-islands-in-astro), [Astro islands: the setup that killed my React bundle](https://abrarqasim.com/blog/astro-islands-the-partial-hydration-setup-that-killed-my-react-bundle/), [server islands (Netlify guide)](https://developers.netlify.com/guides/how-astros-server-islands-deliver-progressive-rendering-for-your-sites/), [Server Islands (Astro blog)](https://astro.build/blog/future-of-astro-server-islands/).
Vue / Nuxt: [Nuxt hydration mismatch: why and how to fix](https://dev.to/parsajiravand/nuxt-hydration-mismatch-why-it-happens-and-how-to-fix-it-5b7i), [nuxt #12266](https://github.com/nuxt/nuxt/issues/12266), [Fixing Nuxt hydration mismatches in the real world](https://ryanclements.dev/posts/fixing-nuxt-hydration-mismatches-in-the-real-world), [vize #8859 Vapor SSR fallback](https://github.com/ubugeeei-prod/vize/issues/8859).
Solid: [solid-start #1110](https://github.com/solidjs/solid-start/issues/1110), [#1286](https://github.com/solidjs/solid-start/issues/1286), [#1752](https://github.com/solidjs/solid-start/issues/1752), [SolidStart v2 config (`experimental.islands`)](https://docs.solidjs.com/solid-start/v2/reference/config/solid-start), [Solid Router migration (islands)](https://docs.solidjs.com/solid-router/guides/migration), [The grand unifying architecture of frontend](https://dev.to/playfulprogramming/the-grand-unifying-architecture-of-frontend-bhk), [SolidJS 2.0 beta (InfoQ)](https://www.infoq.com/news/2026/05/solidjs-2-async/), [Islands & server components & resumability, oh my](https://dev.to/this-is-learning/islands-server-components-resumability-oh-my-319d), [Resumability, WTF?](https://dev.to/this-is-learning/resumability-wtf-2gcm), [Hydration is pure overhead](https://www.builder.io/blog/hydration-is-pure-overhead).
Svelte: [svelte #15200 excessive hydration markers](https://github.com/sveltejs/svelte/issues/15200), [svelte #11509 mismatch with adapter-static](https://github.com/sveltejs/svelte/issues/11509), [Svelte 5 runes migration guide](https://arc.dev/employer-blog/svelte-5-runes-migration-guide/), [`hydratable` docs](https://svelte.dev/docs/svelte/hydratable), [CVE-2025-15265](https://security-tracker.debian.org/tracker/CVE-2025-15265).
Marko: [Marko](https://markojs.com/), [Introducing the Marko Tags API preview](https://dev.to/ryansolid/introducing-the-marko-tags-api-preview-37o4), [Marko: compiling fine-grained reactivity](https://dev.to/ryansolid/marko-compiling-fine-grained-reactivity-4lk4), [Resumability — a new primitive (IEEE)](https://ieeexplore.ieee.org/abstract/document/10388344/).
Server-driven: [HTMX 4 vs Datastar 2026](https://kishansavaliya.com/blog/hypermedia-htmx-4-datastar-2026), [Datastar basics](https://www.jeffhui.net/writings/2025/datastar/), [I switched from htmx to Datastar (HN)](https://news.ycombinator.com/item?id=45536000), [Alternatives to htmx](https://htmx.org/essays/alternatives/), [Is LiveView overhyped?](https://underjord.io/is-liveview-overhyped.html), [LiveView and the cost of state](https://hexshift.medium.com/phoenix-liveview-and-the-cost-of-state-memory-shape-retention-and-long-lived-process-design-ed90238bba02), [How to correctly handle latency with LiveView](https://elixirforum.com/t/how-to-correctly-handle-latency-with-liveview/62021), [HN on LiveView offline](https://news.ycombinator.com/item?id=34189647).
Platform: [HTML invoker commands (InfoQ)](https://www.infoq.com/news/2026/01/html-invoker-commands), [Invoker commands guide](https://blog.openreplay.com/invoker-commands-api-guide/), [declarative dialog / popover control (Chrome guidance)](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/ui-behaviors/declarative-dialog-popover-control.md), [Speculation Rules: instant navigations](https://www.corewebvitals.io/pagespeed/speculation-rules), [Speculation Rules + View Transitions (ICS)](https://ics.media/en/entry/260415/), [It's time for modern CSS to kill the SPA](https://www.jonoalderson.com/conjecture/its-time-for-modern-css-to-kill-the-spa/), [Improving Google Search with compression dictionaries](https://developer.chrome.com/blog/search-compression-dictionaries), [Shared compression dictionaries (DebugBear)](https://www.debugbear.com/blog/shared-compression-dictionaries).
Survey: [State of JavaScript 2025: front-end frameworks](https://2025.stateofjs.com/en-US/libraries/front-end-frameworks/), [State of JS 2025 (InfoQ)](https://www.infoq.com/news/2026/03/state-of-js-survey-2025), [State of JavaScript 2025 takeaways](https://strapi.io/blog/state-of-javascript-2025-key-takeaways).
Incremental computation (adjacent): [Incremental computation and the web (Jane Street)](https://blog.janestreet.com/incrementality-and-the-web/), [A static slicing method for functional programs](https://dl.acm.org/doi/10.1145/3302516.3307345).


## 11. S1 result (2026-10-18, this container: Node 24.14.1, 4 vCPU cloud host, no bench lock — ratios only)

Harness: `apps/ssr-bench/spikes/structural/bench.ts` — the ssr-bench `/resume` page standalone (nested layout with a signal + handler, 1000 keyed `<For>` rows with a per-row click handler, reactive `data-state`, link), compiled in-process three ways and rendered in interleaved rounds (7 rounds × 20 samples at 100 rows, × 4 at 1000; min / median ms per render): **resume** = today's serialized resume (`resumableToString`, server resume target); **static** = plain `renderToString` (the floor); **structural** = plain server target of a hand-lowered source carrying what the structural / derived model records — `_b` boundary records per interactive component, `_sig` keyed signals with wake sets on tracked reads (one `Set.add` per boundary-first read), one JSON tail with the rows as loader data (as every lane ships them); **structural-dom** = the same without the rows in the tail (every row value is rendered verbatim as a sole text child, so a compiler can read the rows back from the DOM on first use — the DOM-as-value-store case of round 1 §3, bound only, not built).

| rows | lane | ms / render (min) | median | × static | HTML bytes | HTML br |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 100 | resume | 0.373 | 0.590 | 2.97× | 103,225 | 16,231 |
| 100 | static | 0.152 | 0.198 | 1.00× | 78,260 | 7,592 |
| 100 | structural | 0.191 | 0.252 | 1.27× | 94,604 | 12,717 |
| 100 | structural-dom | 0.152 | 0.197 | 0.99× | 78,399 | 7,694 |
| 1000 | resume | 4.193 | 4.589 | 1.93× | 971,983 | 130,334 |
| 1000 | static | 2.142 | 2.377 | 1.00× | 779,999 | 71,580 |
| 1000 | structural | 2.653 | 3.022 | 1.27× | 941,882 | 121,206 |
| 1000 | structural-dom | 2.095 | 2.321 | 0.98× | 780,138 | 71,712 |

Findings:
1. **The model's own bookkeeping costs nothing measurable.** Boundary records, keyed signal values and wake sets land within noise of the plain render (0.98–0.99× static) and add 139 bytes to the page. The whole structural overhead (1.27×) is `JSON.stringify` of the rows — the loader data every lane serializes today (the resume lane's `j` tree, Solid's seroval payload).
2. **Against the gate** (§8 S1: ≥ 2× CPU vs HEAD resume): met at 100 rows with the rows tail (2.3×), and at both sizes without it (3.0× / 2.0×); with the rows tail at 1000 rows 1.5×, because resume's overhead there is dominated by the same data serialization. The decisive quantity is not the model but **whether rendered data is shipped twice**; the compiler can prove when it need not be (values rendered verbatim, invertible bindings), which this harness only bounds.
3. HTML: structural-dom = static + 139 B; with the rows tail, −3 % raw / −7 % br vs resume (the per-element ids and per-site markers gone, the data unchanged).
4. Not measured here: peak RSS per lane (in-process harness; the Docker fair comparison owns that), the ui dashboard showcase (widget-heavy page: adopted-layer cost, spike S3), Firefox. Absolute ms are from a loaded cloud host; ratios only.


## 12. S2 result (2026-10-18, this container: Chromium 141.0.7390.37 via `RESUME_BENCH_CHROME`, Slow 4G + 4× CPU, 5 repeats, lanes interleaved, no traces, 4 vCPU cloud host with no bench lock — ratios and bytes are the signal)

Lane `apps/resume-bench/lanes/rivet-derived/`: the fixture as a hand-written derived client (static page + values tail + inline loader + route slice + lazy detail chunk + idle analytics chunk; esbuild-minified; no framework runtime; passes `--verify`). Sizes: loader 714 B br inline, slice 1,021 B br, detail 164 B, analytics 65 B, document 5.3 KB br incl. the 1.9 KB values tail (items as JSON, as every lane ships them). Two runs: the first exposed three loader-level gaps (the slice evaluated and the values parsed at the first input instead of at idle; the lazy route chunk not fetched ahead; the list rebuilt on an unchanged filter result), all things Rivet's current planner already does, so the lane was corrected and re-measured. Second run, medians (min–max), columns = Rivet HEAD / **derived** / Solid 1.9.15 / Qwik 1.20 / Solid 2 rc / Qwik 2 rc:

| scenario | metric | Rivet | **derived** | Solid 1 | Qwik 1 | Solid 2 | Qwik 2 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| load | documentBytes | 9,840 | **5,511** | 7,123 | 20,567 | 7,149 | 19,316 |
| load | jsBytesBeforeInteraction | 25,514 | **1,911** | 8,308 | 27,476 | 23,091 | 39,561 |
| click | paint / latency | 53.8 / 29.0 | **26.1 / 7.1** | 25.3 / 7.8 | 51.2 / 27.7 | 26.5 / 9.3 | 45.5 / 31.4 |
| keyClick | paint / latency | 25.5 / 5.2 | **19.9 / 4.2** | 21.7 / 4.5 | 38.8 / 24.1 | 22.4 / 6.2 | 35.8 / 21.8 |
| tapClick | paint / latency | 41.5 / 26.0 | **39.4 / 24.1** | 36.2 / 21.7 | 54.9 / 39.5 | 37.4 / 23.2 | 52.2 / 39.3 |
| hoverClick | paint / latency | 47.2 / 23.5 | **23.9 / 7.8** | 25.0 / 9.9 | 48.8 / 33.1 | 29.8 / 12.1 | 52.2 / 39.8 |
| filter | paint / latency | 113.4 / 56.0 | **96.8 / 33.3** | 80.5 / 39.3 | 266 / 239 | 88.7 / 39.4 | 293 / 263 |
| filterKey | paint / latency | 89.4 / 57.6 | **95.6 / 54.8** | 78.4 / 40.5 | 216 / 175 | 69.4 / 42.1 | 214 / 187 |
| filterSettled | paint / latency | 132.5 / 119.8 | **96.6 / 81.8** | 94.9 / 77.8 | 323 / 278 | 123.5 / 110.9 | 311 / 284 |
| navigate | paint / latency | 65.6 / 38.3 | **61.6 / 44.8** | 217 / 204 | 92.8 / 82.5 | 244 / 234 | 142 / 132 |
| scrollClick | paint / latency | 31.0 / 13.7 | **26.3 / 5.7** | 31.5 / 9.5 | 49.8 / 27.4 | 29.4 / 8.7 | 51.6 / 23.1 |
| scrollClick | maxFrameGap / dropped | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 |

Verdict against the §8 S2 bars: **pass**. Bytes before interaction 1.9 KB ≤ Solid's 8.3 KB (4.3× less; 13× less than HEAD); document 5.5 KB ≤ Solid's 7.1 KB (HEAD 9.8). Paint latency ≤ HEAD on every scenario (filterKey 95.6 vs 89.4 is inside both ranges). First-DOM-mutation latency vs HEAD: click 4.1×, hoverClick 3.0×, scrollClick 2.4×, keyClick 1.24× (both at the floor, Solid 4.5). Against Solid 1.9 (hydrated at load, the best latency peer): a tie on every latency metric within ranges, navigation 3.5× faster, with 4.3× less JS and a 23 % smaller document. `tbtBeforeInteraction` is noise-level across lanes on this host (Qwik 1 lowest; its document is streamed differently) and not a framework signal here.

What the spike taught, to carry into the compiler:
1. "Nothing runs before input" is the wrong absolute. A module whose top level only defines functions, and a `JSON.parse` of the values tail, cost ~1 ms at 4× CPU and buy a synchronous first input (click latency 19.7 → 7.1 ms). Rule: fetch ahead at idle **and** evaluate definitions-only modules + parse values at idle; never run page code before input.
2. Lazy route chunks are part of the route's fetch-ahead closure (navigate 217 → 62 ms); the planner's `lazy` list already does this in Rivet.
3. The derived list writer needs the keyed-reconcile fast path (unchanged result → no DOM work); every lane's reconciler has it.
4. The values tail is the next byte lever (1.9 of 5.3 KB br here): rows rendered verbatim need not ship (S1 §11 `structural-dom`).
Owed on the bench host: absolute numbers, Firefox, the `fast` condition, the dashboard-shaped page (S3).


## 13. S3 result (2026-10-18, this container: Chromium 141 via `RESUME_BENCH_CHROME`, ui-docs built in-container, 5 repeats per profile)

Harness: `apps/resume-bench/spikes/s3-dashboard.ts` on the built ui-docs **dashboard showcase frame** (`/examples/showcase-dashboard/frame/`: Kpi cards with sparklines, area + donut charts, a DataGrid, a period Segment driving a keyed `<Show>`, a SearchField filter) as Rivet renders and resumes it today. Scenarios: the first click on the period Segment ("7 days" — the keyed `Show` re-creates the KPI + chart subtree on the client: a client run of most of the page, i.e. an upper bound for an adopt run of it), then typing into the orders SearchField (DataGrid filter). Caveat: docs example frames plan preloads with `preload.background = 0` (intent / eager only, `docs/benchmarks/2026-10-11-preload-background.md`), so the chunks a click needs are fetched at the click; an app page with the default 1 MiB budget prefetches more at idle. The nx build's final docs-kit Chromium check phase failed in this container (Playwright build 1243 not installed); the prerendered output is complete.

| metric | slow (Slow 4G + 4× CPU) | fast (unthrottled) |
| --- | ---: | ---: |
| document bytes (served, compressed) | 16,597 | 16,597 |
| resume state bytes (raw, `rivet/state`) | 27,789 | 27,789 |
| JS requests / bytes before input (3 s idle) | 29 / 70,397 | 29 / 70,397 |
| period click → DOM change / paint (ms) | **2,255 / 2,295** (2,237–2,338) | 108 / 117 (107–159) |
| JS requests / bytes fetched by that click | **74 / 76,185** | 74 / 76,185 |
| search typing → DOM change / paint (ms) | 183 / 200 | 7.8 / 28 |
| JS requests fetched by the search | 6 | 7 |

Findings:
1. **Request count, not CPU, is the first-interaction cost on a widget page.** Unthrottled the period click costs 108 ms (chunk fetch + the client re-creation of KPIs + charts); under Slow 4G the same click costs 2.25 s because 74 chunks (one per component / symbol, 76 KB) are fetched on the click over a 150 ms RTT link. This is the per-component chunking the route-chunks experiment could not get under 61 requests (`docs/benchmarks/2026-10-12-route-chunks.md`) and the case the derived client's route-closure bundling (round 2 §3.7, spike S5) exists for: one route slice + one component chunk, fetched ahead at idle, would leave the click with the CPU part only.
2. **The adopt-run bound for this page is ≈ 100 ms unthrottled** (≈ 300–400 ms at 4× CPU once the network is out of the picture), measured as today's client re-creation of the KPI + chart subtree, which creates nodes an adopt run would not. That is the honest cost of the adopted layer on a page whose widgets (charts, grid, segment) all live on it (P1: cdk / ui are sidecar-tier, i.e. adopted-layer, components). It is also the cost Solid pays at load for the same page, and what any framework pays to re-render charts on a period change — the derived model's lever is that it is paid once, on the touched widget, after a 1–3-request fetch-ahead, not 74 requests deep.
3. **State: 27.8 KB raw for one frame** (document 16.6 KB compressed). The values-only wire format (S1 §11: bookkeeping ≈ 0, the rest is data) would keep the loader data and drop the records; the lazy-state note's bound tables say the same for Select / ComboBox.
4. **Typing is fine today** (search 7.8 ms unthrottled, 183 ms slow = 6 chunk fetches): a derived slice for the filter would make it ≈ the slow-link floor (one fetch-ahead, 0 at the key).
Owed: the same page with the default preload budget (an app route, not a docs frame), the bench host for absolute numbers, and the derived + adopted prototype of this page (the real S3 gate: first click ≤ HEAD + one frame with ≤ 3 requests).
