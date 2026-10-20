# Homepage design: competitive analysis + page spec (lane HOMEPAGE-DESIGN, 2026-10-11)

- Scope: `apps/docs` landing (`apps/docs/src/routes/index.tsx` + `apps/docs/src/home.css`) rebuilt as a page that sells; this doc = research + design, no code. Build lane = HOMEPAGE (task list in §5).
- User (2026-10-11): "our landing has to be more selling"; "migrate to our ui lib"; static "Render once on the server. Resume in the browser." "is not appealing"; wants animations and switching text ("framework built to be fast/performant/dynamic/yours"); "think more on homepage. take look at others, like solid, vercel, next, astro".
- Standing rules: boxed charts / tables read as "cheap", "90s" (memory homepage-must-sell); soft gradients, de-cloned (docs-identity-b); brand palette = `logo.svg` gradient (root CLAUDE.md); no AI images; lucide icons only; numbers only from committed reports (`apps/docs/content/_charts.ts`).
- Motion: `libs/motion` not landed; spec [`2026-10-11-motion-design.md`](2026-10-11-motion-design.md) (awaiting GO) + plan `docs/design/plans/2026-10-11-motion.md`. Its `whileInView` / `createInView` / entrance effects need JS (IntersectionObserver / `clientEffect`) before input, and SSR `initial` renders invisible without JS (its Q1) → the homepage keeps everything that moves BEFORE interaction in CSS (headline, bars, count-up) and uses `@rivetjs/motion` only for interaction-driven motion (demo readout `Presence`, showcase) once landed; until then kit `<Transition>` (§3.0).

## 1. Competitive analysis (7 sites, browsed 2026-10-11, 1440×900 + 375×812)

- Page weight column: in-page `performance` resource entries after load, mobile viewport, in-app browser (warm DNS, possibly warm cache, cross-origin sizes can read 0) → order of magnitude only, not a benchmark.

| Site | Hero pattern | Proof devices | Motion | CTA | Weight (JS req / KB, DOM nodes, LCP) |
| --- | --- | --- | --- | --- | --- |
| solidjs.com | Logo lock-up + one-line promise on a blue isometric-blocks panel; award badge top right | krausest bar list (ratio to vanilla, Solid first), stat row (7 kb, stars, years), 4 adjectives | almost none; playground lazy "Starting playground…" | Get Started + two video intros | 4 / 162, 397, 328 ms |
| vercel.com | Black, centered glowing triangle; 2-word headline left, 3 benefit lines right; logo marquee under the fold line | logo wall (Meta, OpenAI, …), customer one-liners with numbers per section ("100 million monthly visits"), product UI screenshots | mobile: monospace benefit line types/rotates under the headline; marquee; glow | Deploy now / Talk to sales | 56 / 694, 1116, 492 ms |
| nextjs.org | Huge centered sans headline, grey sub-copy with two bold phrases, faint grid lines | feature grid with micro-visuals, "1440px / 375px" image demo, logo wall, testimonials with numbers (CLS 0.09, 100 ms input) | subtle; grid-line hero | Get Started / Learn + `npx create-next-app@latest` mono line | 36 / 514, 2515, 320 ms |
| astro.build | Version pill, 2-line bold headline on purple gradient, one sub-line, pill CTA + copyable `npm create astro@latest` box, logo wall in the first viewport | CrUX "% sites with good Core Web Vitals" bar list vs WordPress / Gatsby / Next / Nuxt (with dataset link), live islands code → product card demo, big "0" for zero JS | scroll-reveal fades (mid-scroll viewport blank until reveal), hover glows | Get Started + copy command (hero + closing) | 8 / 5, 1837, 424 ms |
| qwik.dev | Huge 3-line centered headline, middle line in brand gradient ("instant apps"), sub-line | Lighthouse-score list of showcase sites (94–99%), sponsor block, vertical tab list (Instant Loading / Resumable / …) switching an annotated code shot | gradient text, tab switches | `npm create qwik@latest` as the primary button + Explore the docs | 180 / 661, 790, 236 ms |
| svelte.dev | Lowercase serif-ish headline left, 3D Svelte "machine" on a conveyor right; dictionary-entry joke (/ˈsvɛlt/ adj.) | "most excited about" claim, logo wall, contributor wall, documentary | conveyor illustration (static-feeling), playful | GET STARTED (orange text link) | 28 / 127, 412, 404 ms |
| tanstack.com | Full-bleed photo (palm tree on a pastel sky), headline left with underlined phrase, sub right; stat bar (20.2B downloads, weekly, stars) | download / star counters, "Framework Agnostic" node diagram, typed-field chips (`params.postId string`), license / governance facts table | prompt box "Describe what you want to build", diagram highlight | Browse the Stack / Start with a prompt | 43 / 627, 1144, 420 ms |

Per site: steal / avoid.

- **Solid**
  - Steal: a benchmark chart as a first-class section, framework ordered by score, own bar highlighted; one-sentence promise.
  - Avoid: 2021-era look (boxed blue hero panel, 4 equal adjective cards, stat boxes); krausest-only proof (client-only, ratio unit unexplained); hero says nothing about the mechanism.
- **Vercel**
  - Steal: radical restraint (black, one glow object, 2 words); 3 benefit lines as the sub-copy; rotating monospace benefit on mobile; numbers attached to named outcomes per section.
  - Avoid: 700 KB JS for a marketing page; heavy product screenshots; logo walls we do not have (fake social proof = worse than none).
- **Next.js**
  - Steal: centered big-type hero + command line under the CTAs; "what's in it" grid where every tile has a small live visual; the 1440 / 375 toggle (show, don't claim).
  - Avoid: 2,515 DOM nodes / 514 KB JS on a landing; testimonials-as-proof; generic feature names without numbers.
- **Astro** (closest model; same audience, performance-first)
  - Steal: copyable `npm create …@latest` box in the hero AND the closing CTA; a performance chart against named competitors with a "full dataset" link; one giant number ("0" JS) as a visual; page ships ~5 KB JS.
  - Avoid: scroll-reveal that leaves the viewport blank (content hidden until JS/observer fires; hurts LCP on long pages and fast scrollers); purple-gradient-everything (dilutes the accent); logo wall above the fold.
- **Qwik** (direct competitor on resumability)
  - Steal: brand gradient on ONE line of the headline; vertical tab list that switches an annotated code panel (explain the mechanism in 6 beats); command as primary button.
  - Avoid: the resumable framework's homepage loads 180 scripts / ~660 KB (prefetch everything) — the page contradicts the pitch; Lighthouse-score list of random sites (weak proof); "Batteries included" emoji bullets.
- **Svelte**
  - Steal: personality; a strong illustration made by a human (we use real output/numbers instead of art).
  - Avoid: mechanism-free hero; text-link CTA too weak; "developers love it" as the main proof.
- **TanStack**
  - Steal: stat bar directly under the hero; typed-value chips as a DX micro-visual; facts table "License MIT / Hosting anywhere / Paid tiers none".
  - Avoid: stock photo hero (2.3 MB transferred, says nothing); prompt box gimmick.

Patterns across all 7:

- Hero = 1 headline (≤ 7 words, ≥ 64 px desktop), 1 sub-line, 2 CTAs, command line. Nobody explains with paragraphs above the fold.
- Proof that lands: a chart against named competitors with a dataset link (Solid, Astro). Proof that does not: logos, testimonials, Lighthouse lists of third-party sites.
- Premium = big type, few colors, one accent object, generous spacing, motion that serves one point. Cheap = boxed cards in rows, emoji bullets, stat boxes, photos, blank scroll reveals.
- Only Astro's page is light (5 KB JS); the other six ship 127–694 KB. A Rivet homepage that loads only its loader before the first interaction is itself the strongest proof on the market.

## 2. Positioning

- Sentence (the one devs remember): **"Rivet renders JSX on the server at a fraction of Razor's CPU and resumes it in the browser without hydrating."**
  - Short form (hero sub-line, §3.1): "Compiled JSX. Server-rendered at a fraction of Razor's CPU. Resumed in the browser, never hydrated."
- Audience: devs who ship SSR apps (Node or .NET today) and care about server cost, first-interaction latency and DX; secondary: HeroUI / React Aria users wanting the same components without React.
- 3 claims provable tonight (numbers = `docs/benchmarks/2026-10-09-fair-comparison.json`, via `_charts.ts`; Apple M4 Pro, 1 CPU / 512 MiB per lane, medians of interleaved repeats):
  1. **Server: 3.6× less CPU per page than ASP.NET Razor** (static SSR, 1,000 rows, c1: Rivet 0.46 ms, Solid 1.9 static 1.34 ms, Razor .NET 10 1.64 ms; 6.0× at 5,000 rows: 1.83 vs 10.94 ms; peak memory 88 vs 122 MiB). Report verdict WIN (≥ 3 %, non-overlapping ranges).
  2. **Browser after resume: navigation 2.1× faster than the fastest Qwik, 4.6× faster than Solid** (slow 4G + 4× CPU, input → paint: Rivet 41.8 ms, Qwik 1.20 89.7, Qwik 2 rc 114.9, Solid 1.9 192.4); first click level with Qwik (33.0 vs 32.4 / 32.9 ms, TIE), 1.5× faster than hydrating Solid (49.3).
  3. **DOM updates 1.9× faster than Solid 1.9, 7× faster than React 19** (1,000 rows, update every field: 2.75 vs 5.25 vs 19.27 ms; mount 20.2 vs 21.2 vs 60.9 ms = WIN but only 1.05× vs Solid → not a headline).
- 1 honest loss (shown on the page): **purely static content sites — Astro, Eleventy and Hugo ship 0 KB of JavaScript, Rivet ships its 4.7 KB loader + 65 KB of prefetched modules; Lighthouse LCP 1.20 vs 1.05 s** (`docs/benchmarks/2026-10-11-editorial.json`, N = 1000). Fix line: "Zero-JS output for pages without handlers is next" (editorial report "What Rivet would need" #1).
  - Second loss kept one click away (benchmarks page + "All numbers" disclosure): interactive SSR, plain hydratable Solid 1.9 (no handlers / links / data) uses 1.75× less CPU than Rivet resumable (1.74 vs 3.04 ms); same-work Solid 1.9 interactive uses 2.1× more (6.37).
- Not claimed: bundle size (krausest LOSE vs Solid 8.25 vs 4.50 kB br — accepted, memory krausest-size-loss-accepted), short-text grids vs Razor (memory razor-text-grid-loss), "dynamic at static cost" (editorial: 3.2× a static file).

## 3. Page spec (section by section)

Global:

- Chrome: keep docs-kit `SiteFrame` top bar + footer columns (shared with every docs page; not rebuilt with ui `Navbar`). Home adds its own sections inside `.lp`.
- Width: content max 1200 px; hero + numbers full-bleed backgrounds; side gutter 24 px desktop, 16 px mobile; no horizontal scroll (`overflow-x: clip` on `.lp`, as today).
- JS budget before first interaction: the resume loader only (inline, ≤ 2,237 B budget per preload doc) — zero component modules, zero prefetch. Route sets `preload: { background: 0 }` and every home widget preloads on intent (pointerover / focus / touchstart), never `visible`. Everything that moves before interaction is CSS.
- Every number rendered = value from `_charts.ts` (or `_home-perf.json`, §3.9), never typed; ratios computed (`advantage()`), as today.

### 3.0 Motion layer (until `@rivetjs/motion` lands)

- `apps/docs/src/components/home/RotatingWords.tsx`: server-rendered, CSS-only (props `words: string[]`, `label: string`, `period` default 2600 ms). MOTION lane may swap internals only if the swap keeps 0 JS before input (CSS stays the default); the props stay.
- After `@rivetjs/motion` lands: demo readout swap = `<Presence>` + `Motion.div` (`initial={false}` on first render → visible without JS, motion spec Q1), `MotionConfig reducedMotion="user"`; no `whileInView` on this page.
- `apps/docs/src/components/home/CountUp.tsx`: server-rendered number with CSS `@property` + `animation-timeline: view()` count-up (no JS); `Bar` variant for chart bars.
- kit `<Transition>` only for interaction-driven state (demo panel, showcase tabs): enters 180 ms `cubic-bezier(0.22, 1, 0.36, 1)`, exits 120 ms `cubic-bezier(0.4, 0, 1, 1)`.
- Global rule: `@media (prefers-reduced-motion: reduce)` → no keyframes, no view timelines, transitions ≤ 1 ms opacity only; final state rendered.

### 3.1 Hero

- Purpose: in 5 s the dev knows (a) what it is (JSX framework), (b) why it is different (server CPU + resume), (c) how to start.
- Layout desktop (≥ 1024 px): centered column, eyebrow pill, h1 2 lines (line 2 = rotating word), sub-line ≤ 2 lines at 640 px measure, CTA row, then the proof strip (§3.2) as the hero's bottom edge inside the first viewport (900 px tall). Background: one soft brand glow (existing `HeroGlow`, CSS fallback radial gradient so first paint is identical without canvas), no grid lines, no photo.
- Layout mobile (375 px): left-aligned (centered 3-line headings wrap badly), h1 40 px / 1.05, rotating line on its own line, CTAs full-width stacked (command box first), proof strip becomes a 3-row list under the fold.
- Copy (final):
  - Eyebrow pill: "Experimental" (link → `/about/roadmap/`; no "not on npm yet", ruling 2026-10-11). Swap to version pill at the first release.
  - h1 line 1: "The JSX framework built to be"
  - h1 line 2 (rotating): "fast." → "resumable." → "dynamic." → "yours." (ruling 2026-10-11)
  - h1 accessible name (visually hidden, the rotating span is `aria-hidden="true"`): "The JSX framework built to be fast, resumable, dynamic and yours."
  - Sub-line: "Compiled JSX. Server-rendered at a fraction of Razor's CPU. Resumed in the browser, never hydrated." → fix round 1 (2026-10-12): "Compiled JSX. {ratio} less server CPU than ASP.NET Razor. Resumed in the browser, never hydrated." (ratio computed from `homeStrip`).
  - Primary CTA: command box `npm create rivet@latest` with copy button (`CopyButton`, lucide `Copy` → `Check` on success, `aria-live="polite"` "Copied"). Ruling 2026-10-11: shows `npm create rivet@latest`, no "coming soon" badge / note (the `git clone` line moves to the quick start). Superseded 2026-10-12 (review H2): ui `Chip` "Pre-release · npm publish pending" (lucide Hourglass) beside every `npm create` command; the shared footer drops "packages are not published to npm yet".
  - Secondary CTA: ui `Button` variant `ghost`/`tertiary`, "See the numbers", lucide `ArrowDown`, `href="#numbers"` (anchor; smooth scroll via CSS `scroll-behavior: smooth` gated on no-preference).
  - Tertiary text link: "Get started" → `/start/quick-start/` (lucide `ArrowRight`).
- Rotating words — 6 candidate sets:
  1. fast / performant / dynamic / yours (user's example; "performant" + "dynamic" are vague and unprovable)
  2. fast / resumable / dynamic / yours ← **chosen by ruling 2026-10-11**: "dynamic" proven by the per-request (dynamic rendering) chart
  3. fast / resumable / accessible / yours (spec proposal; "accessible" moved to the feature grid)
  4. fast / compiled / resumable / honest (too inward-looking; "honest" needs explaining)
  5. 3.6× faster than Razor / resumable / accessible / yours (number in the h1 goes stale at every bench refresh and breaks the line width on mobile)
  6. instant / resumable / typed / yours ("instant" is Qwik's word; "typed" is table stakes)
- Why the chosen set: every word maps to a proof section on the same page — fast → §3.2 numbers, resumable → §3.3 demo, dynamic → §3.2 dynamic-rendering chart, accessible (feature grid) → §3.5 React Aria / HeroUI 1:1 ports with upstream tests, yours → §3.6/§3.7 (MIT, no vendor, every subpath tree-shakes, works with your AI tools). Ends on "yours" = the emotional close.
- Animation (exact):
  - Markup: `<span class="rw" aria-hidden="true"><span style="--i:0">fast.</span>…<span style="--i:3">yours.</span></span>`; `.rw { display: inline-grid }` with every word in `grid-area: 1 / 1` → slot width = widest word, zero layout shift; `text-align: start`; line 2 text in the brand gradient (`background-clip: text`, §4).
  - Server HTML: word 0 visible (opacity 1), others `opacity: 0` → LCP element = h1 painted with "fast." on first frame, no JS.
  - Keyframes per word (one `@keyframes rw` shared, offset by `animation-delay: calc(var(--i) * 2600ms)`, duration 10,400 ms = 4 × 2,600): 0–3.8 % enter (≈ 400 ms: `translateY(0.35em)` → 0, `opacity` 0 → 1, `filter: blur(6px)` → 0, easing `cubic-bezier(0.22, 1, 0.36, 1)`); hold to 21.2 % (≈ 1,800 ms); 21.2–25 % exit (≈ 400 ms: → `translateY(-0.35em)`, opacity 0, blur 6px, easing `cubic-bezier(0.55, 0, 1, 0.45)`); rest hidden. Enter of word n+1 overlaps the exit of word n by 0 ms (exit ends where the next enter starts — crisp, no cross-fade mush).
  - Word 0 starts in its hold phase (`animation-delay` negative by 400 ms) so the first frame is not mid-enter.
  - Runs 2 cycles (≈ 21 s) then stops on "yours." (`animation-iteration-count: 2`, last word `animation-fill-mode: forwards` with a final keyframe variant `rw-last` that holds). WCAG 2.2.2 (auto-moving > 5 s): pause control = small icon button after the h1 (lucide `Pause` / `Play`, 32 px target, `aria-label="Pause headline animation"`), implemented CSS-only as `<label>` + visually-hidden checkbox; `.lp:has(#rw-pause:checked) .rw > *` → `animation-play-state: paused`. Also paused on `:hover` / `:focus-within` of the h1. Zero JS.
  - `prefers-reduced-motion: reduce`: no animation; line 2 renders "fast." only (same size) (the visually hidden full sentence is read anyway) + the four words as a muted inline list under the sub-line ("Fast · Resumable · Accessible · Yours"). Pause button hidden.
  - Print / no-CSS: the visually hidden full sentence is the text.
- Components: ui `Button` (secondary CTA), ui `Chip` (eyebrow pill), docs-kit `CopyButton`, kit `Icon`. Not ui `Card`.
- Data: none (copy only).
- Perf budget: hero HTML ≤ 6 KB raw; 0 JS; LCP = h1 text node; fonts: Geist 650 + 400 preloaded (`<link rel=preload>` 2 woff2 files, ~2 × 25 KB) with `size-adjust` fallback already in `theme.css` → CLS 0 on swap; glow canvas (if kept) only after interaction-free idle via `HeroGlow`'s existing path — or replaced by a CSS radial gradient (preferred: canvas = JS before interaction; check `HeroGlow` cost in task 1 and drop it if it ships a module before input).

### 3.2 Live proof strip ("the numbers", `id="numbers"`)

- Purpose: three numbers a dev can repeat in a meeting, each a chart with the competitors named, each linked to its report.
- Layout desktop: 3 columns, no boxes, separated by 1 px hairlines (`--color-border` at 50 %); each column = big number (CountUp) + one-line claim + small horizontal bar chart (4–5 bars) + "Source · method" link. Mobile: stacked, each chart full width, 24 px between.
- Charts (data via `_charts.ts` points, same chart ids as `about/benchmarks.md`):
  1. "3.6×" — "less CPU per server-rendered page than ASP.NET Razor" — bars `ssr-static-cpu` group 0: Rivet 0.46 / Solid 1.9 static 1.34 / Razor .NET 10 1.64 ms; footnote "6.0× at 5,000 rows" from `fair.ssr.tuned["5000"]["1"]` rivet-compiled vs dotnet (add chart point export `ssrStatic5000` in `_charts.ts`).
  2. "2.1×" — "faster navigation after resume than the fastest Qwik, on slow 4G" — bars `resume-input-paint` group Navigate: Rivet 41.8 / Qwik 1.20 89.7 / Qwik 2 114.9 / Solid 2 194.1 / Solid 1.9 192.4 ms; footnote "First click: level with Qwik (33.0 vs 32.4 ms)".
  3. "1.9×" — "faster DOM updates than Solid, 7× faster than React" — bars `dom-update-1000` group "Update 100%": Rivet 2.75 / Solid 1.9 5.25 / Solid 2 5.00 / React 19 19.27 ms.
  - Big numbers computed with `advantage()` + `formatValue(…, 1)` — never typed (`tests/charts.test.ts` gains the 3 values).
- Loss row (full width under the 3 columns, muted, lucide `Scale` icon): "Where we lose: static content sites. Astro, Eleventy and Hugo ship 0 KB of JavaScript; Rivet ships a 4.7 KB loader and prefetches 65 KB. Zero-JS output for pages without handlers is next." → link "Editorial benchmark" (`docs/benchmarks/2026-10-11-editorial.md`). Numbers from `2026-10-11-editorial.json` `output["1000"].rivet.article.inlineJS` and `serve["1000"].rivet.client.jsBytes` (new `editorialLoss` export in `_charts.ts`).
- Under the row (fix round 1, 2026-10-12: a plain "All numbers" link to `/about/benchmarks/`, no BenchGrid in the home HTML — HTML budget): ui `Disclosure` "All numbers" → existing `BenchGrid` (keeps interactive-SSR loss visible; `site.test.ts` loss assertion moves from the BenchProof tab to this grid + the loss row).
- Chart style: horizontal bars, 10 px tall, 6 px radius on the value end only, 8 px gap; Rivet bar = brand gradient (§4, cyan → indigo → violet, left to right), competitors = `--color-fg` at 18 % (light) / 22 % (dark); labels left (Geist 13 px), values right of the bar end (Geist Mono 13 px, tabular-nums); lower-is-better noted once per chart as "ms, lower is better" in the caption; no axes, no gridlines, no legend, no box, no shadow.
- Motion: in view (CSS `animation-timeline: view()`, `animation-range: entry 20% cover 40%`): bars `scaleX(0 → 1)` from the start edge, 700 ms equivalent, `cubic-bezier(0.22, 1, 0.36, 1)`, staggered 60 ms per bar via `animation-delay`; big number counts up 0 → value (`@property --n { syntax: "<integer>" }` in hundredths; displayed with `counter(int) "." counter(frac, decimal-leading-zero)` via `round(down, …)` / `mod()`). Unsupported (Firefox without scroll timelines) → final values, no animation (feature query `@supports (animation-timeline: view())`). Reduced motion → final values. The real number is text in the DOM (`<data value>`), the animated counter is a `::after` pseudo-element, `aria-hidden` by construction.
- Components: ui `Disclosure`, kit `Icon`, home `CountUp` + `BarList` (new, plain elements, no ui `Chart` — ui Chart is SVG/JS-driven; check: if ui `Chart` renders static SVG server-side with zero client code, prefer it; otherwise `BarList`).
- Perf budget: ≤ 4 KB HTML for the 3 charts, 0 JS, CLS 0 (bars animate `transform` only, numbers reserve width via `min-width: Nch` from the final string length).

### 3.3 "How resumability works" — real interactive demo

- Purpose: make "no hydration" visible: the reader clicks a real button on this page and sees what the browser loaded for it.
- Layout desktop: 2 columns. Left: 3-step rail (vertical, lucide `Server`, `FileCode`, `MousePointerClick`), step texts below. Right: a live panel = the demo widget + a "network" readout + the compiled handler snippet. Mobile: panel first, rail below as a horizontal 3-step row.
- Copy (final):
  - Kicker: "Resumability"
  - h2: "Click it. That's the only code this page has loaded."
  - Step 1 "Server" — "Your component runs once, on the server. The HTML arrives finished, with the state its handlers need."
  - Step 2 "Page load" — "No component code runs. No hydration. The browser waits for you."
  - Step 3 "First click" — "The one handler you touched loads and updates one text node."
  - Widget button: "Like" with count (`{likes} likes`), lucide `Heart`.
  - Readout before click (server-rendered, real): "Component rendered on: server" · "JavaScript executed so far: loader only (X B inline)" (X = inline loader bytes, measured at build time by the prerender and written into `_home-perf.json`; §3.9).
  - Readout after click (computed by the handler itself from Resource Timing): "Fetched for this click: N files, X KB over the network (Y KB uncompressed), in T ms" + file names, and apart from it "Already prefetched before the click: M files, …" + file names (requests started before the click's `timeStamp`: hover / focus intent, runtime an earlier interaction loaded; hidden when none) + "Component re-ran: no — still rendered on: server". The demo has its own intent chunk (HOME-CLICK 2026-10-20), so both groups cover only its handler closure.
  - Link: "How resuming works" → `/learn/resuming/`.
- Mechanism (real, not simulated):
  - Demo = a normal resumable component `apps/docs/src/components/home/ResumeDemo.tsx` with `signal` likes + inline arrow handler (resumable rules: inline arrow, `_rFn`).
  - "Rendered on" text = a server-only value: `const where = import.meta.env.SSR ? "server" : "browser"` evaluated in the component body and rendered once. If the component re-ran in the browser it would print "browser" — the test (§5) asserts it still says "server" after 3 clicks. The component must own a region (`_regionState`) so the first signal change does not re-create it (root CLAUDE.md gotcha "Resumed pages re-create a component on the first signal change when the component has no own region") — wrap the dynamic part in its own element binding, verify with the browser test.
  - Bytes: inside the click handler, `performance.getEntriesByType("resource")` filtered to `initiatorType` script / link and URLs from the manifest chunk prefix (`/assets/`), with `startTime >= performance.now() - (now - event.timeStamp) - 50` → the chunks fetched for this interaction; `transferSize` (0 = cache → report "from cache"), `encodedBodySize`, `decodedBodySize`, `responseEnd - startTime`. Resource Timing is recorded by the browser without page code → no pre-click JS needed.
  - Handler snippet (right column, under the readout): the real compiled DOM output of the demo's handler, from a compiled fence fragment (`content/_home-demo.md`, `compiled` fence, same mechanism as `_home-hero.md`), so the reader sees the bytes they just loaded.
- Components: ui `Button` (variant primary, lucide `Heart`), ui `Chip` (status chips "server", "loader only"), ui `Separator`, kit `Transition` for the readout swap (fade + 4 px rise, 180 ms).
- Data: `_home-perf.json` (loader bytes), runtime Resource Timing.
- Perf budget: demo closure ≤ 3 KB br (handler + signal runtime already in the loader path); first-click → paint ≤ 50 ms on slow 4G + 4× CPU (resume-bench click = 33 ms); 0 JS before click, intent preload only.

### 3.4 Feature grid with proofs

- Purpose: breadth, each item a capability + a proof (number or link), no adjectives.
- Layout desktop: 4 × 2 unboxed grid, each cell = lucide icon (20 px, brand-tinted) + title + 1-line proof + link; hairline separators between rows only. Mobile: 1 column, 20 px gap, dividers.
- Items (final copy):
  1. `Zap` "Compiled templates" — "A Rust compiler turns JSX into string templates on the server and cloned DOM in the browser. 1,000-row DOM update: 2.75 ms." → `/learn/signals/`
  2. `Waves` "Streaming SSR" — "The shell flushes first; `<Async>` data streams into place. p99 6.0 ms at 5,000 rows vs Razor 31.5 ms." → `/guides/performance/streaming/` (p99 from fair JSON `ssr.tuned["5000"]["1"]` rivet-compiled / dotnet `p99_ms`).
  3. `Cable` "Function Bridge" — "Closures, classes and contexts resume with plain-JS semantics; failures are named compile errors." → `/learn/resuming/`
  4. `Radio` "Live props" — "Props stay reactive like Solid's; no re-render, no memo." → live props guide page
  5. `Route` "File routing" — "Pages, layouts, loaders, actions and guards on a web-standard handler; Node and static adapters." → `/guides/routing/file-routes/`
  6. `FormInput` "Forms" — "Standard Schema forms that submit before JavaScript loads." → `/guides/forms/forms/`
  7. `Languages` "Compile-time i18n" — "ICU messages inlined per locale. No runtime catalog." → `/guides/i18n/translating-text/`
  8. `Wrench` "DevTools + editor" — "Component tree, signals and updates in the dev server; compiler diagnostics with quick fixes in VS Code." → `/guides/tooling/devtools/`
- Exact link targets: build lane verifies each path exists in `_nav.ts`; any claim without a measured number keeps a link only (no invented numbers).
- Components: kit `Icon`, ui `Link`. Motion: none (static; hover = link underline + icon `translateX(2px)` 120 ms).
- Perf budget: ≤ 3 KB HTML, 0 JS.

### 3.5 UI / cdk showcase (real components, live)

- Purpose: "accessible" proof + migration magnet for React Aria / HeroUI users: the components on this page are the library, rendered by the page itself.
- Layout desktop: left text column (kicker, h2, 3 facts), right a `.ui-stage` (`data-ui-theme="rivet"`, as `apps/ui-docs/src/routes/index.tsx`) with a small composed "settings panel": `Switch` (Notifications), `Slider` (Volume, free drag — memory slider-free-drag), `ToggleButtonGroup` (Daily / Weekly / Monthly), `Select` (Region), `Button` (Save), `Meter` (Storage 64 %), `Chip`s. Mobile: stage full width under the text.
- Copy (final):
  - Kicker: "Components"
  - h2: "HeroUI and React Aria, 1:1, without React."
  - Facts: "Every component is a faithful port: same behaviour, keyboard and screen-reader support, upstream tests included." · "Headless `@rivetjs/cdk` underneath, styled `@rivetjs/ui` on top — or bring your own styles." · "Try it: this panel resumes on your first touch."
  - Links: "Browse components" → `site:ui/` · "Headless cdk" → `site:cdk/`
- Components: ui `Switch`, `Slider`, `ToggleButtonGroup`/`ToggleButton`, `Select` (ListBox popover via cdk overlay layer), `Button`, `Meter`, `Chip`, `Surface` (stage background; not `Card` — class-name clash with the docs frame, see `apps/ui-docs/src/styles.css` comment).
- Styles: same scoped import list as `apps/ui-docs/src/styles.css` (rivet theme + scoped.css + only the component CSS files used), added to `apps/docs/src/styles.css`.
- Resume: every control is a resumable handler; preload on intent (cdk chunks rule `CDK_ON_INTENT` already in `vite.config.ts`). Select closure ≈ 97 KB br (preload doc) → prefetch on `pointerover`/`focus` of the trigger only; no background prefetch on `/`.
- Motion: component-native (HeroUI transitions); no scroll effects.
- Perf budget: stage HTML ≤ 8 KB; 0 JS before interaction; first open of Select ≤ 700 ms throttled h2 (preload doc /themes below-fold Select = 593 ms with prefetch).

### 3.6 Built for AI tooling

- Purpose: AI-assisted devs are the adoption channel (memory goal-external-adoption); show the 3 concrete artefacts.
- Layout: 3 columns (mobile stacked), each = lucide icon + title + 1-line + a mono snippet.
- Items (final copy):
  1. `FileText` "llms.txt" — "Every docs page as Markdown for language models, regenerated on every build." Snippet: `/llms.txt · /llms-full.txt` (links).
  2. `Plug` "MCP server" — "Docs search, component reference and `check_code` (compiler + diagnostics) for your assistant." Snippet: the `@rivetjs/mcp` stdio config line from `apps/docs/content/guides/tooling/ai.md` (fragment import, not retyped).
  3. `BookOpen` "Agent skills" — "`rivet-ui-design` for Claude Code, Codex and Cursor; new starters include it." Snippet: `npx skills add … --skill rivet-ui-design` (from `skills/README.md`).
  - Link: "AI tooling guide" → `/guides/tooling/ai/`.
- Components: kit `Icon`, docs-kit `CopyButton` on each snippet. Motion: none.
- Perf budget: ≤ 2 KB HTML, 0 JS.

### 3.7 Get started code

- Purpose: last step before leaving — show the 10 lines they will write and the 3 commands.
- Layout: left = the existing `home-sample` compiled fence (`Likes.tsx`, "Compiled output" toggle = existing CSS-only radio tabs); right = 3 numbered commands (`npm create rivet@latest my-app`, `cd my-app`, `npm run dev`) each with copy button, then "Node 24+ · npm · Git".
- Copy: h2 "Ten lines to your first resumable page." · sub "Toggle "Compiled output" to read what the server and the browser run — compiled when this page was built." · CTA ui `Button` primary "Quick start" → `/start/quick-start/`, ghost "What is Rivet?" → `/start/what-is-rivet/`.
- Components: ui `Button`, docs-kit `CopyButton`, existing fragment. Motion: tab switch = existing CSS.
- Perf: fragment as today; 0 JS before copy.

### 3.8 Closing CTA

- One line, centered: "Build something fast." + the command box again (Astro pattern) + "Star on GitHub" text link (lucide has no brand icon → text).

### 3.9 Footer: this page's own numbers

- Purpose: the page proves itself.
- Content (above the `SiteFrame` footer columns, one muted mono line):
  - Static (build time, from `apps/docs/content/_home-perf.json`, written by the Lighthouse task §5 T10 and committed with its date): "This page: H KB HTML · L B loader · 0 B other JS before you interact · Lighthouse mobile S · LCP X ms · CLS 0 — measured YYYY-MM-DD." → fix round 1 (2026-10-12): "… · J KB inline JavaScript, no script files before you interact · Lighthouse mobile S · CLS 0 — measured …" (J = every inline script; LCP only once ≤ the 1.05 s bar).
  - Live (on click, ui `Button` size sm ghost "Measure my visit", lucide `Gauge`): the handler reads Navigation Timing (`transferSize`, `responseStart`, `domContentLoadedEventEnd`), buffered LCP (`PerformanceObserver({ type: "largest-contentful-paint", buffered: true })`), and all script Resource Timing entries → "Your visit: TTFB t ms · LCP l ms · JS before your first click: b B". Real numbers from the reader's browser; 0 JS before the click.
- Perf: ≤ 1 KB HTML.

### Section order (final)

1. Hero (+ strip edge) → 2. Numbers (+ loss row, All numbers) → 3. Resumability demo → 4. Features → 5. Components showcase → 6. AI tooling → 7. Get started code → 8. Closing CTA → 9. Footer numbers.

## 4. Visual system

- Type: Geist (display + text) + Geist Mono (numbers, commands, code) — already self-hosted in `libs/docs-kit/theme.css` with metric fallbacks; no third family.
  - h1 72 px / 1.02 / −0.04 em / 650 desktop, 40 px mobile (`clamp(2.5rem, 6vw + 0.5rem, 4.5rem)`); h2 40 px / 1.1 / −0.03 em / 620 (28 px mobile); body 17 px / 1.6 / 400; kicker 13 px / 0.08 em uppercase / 600, brand-tinted; numbers Geist Mono 56 px / 1 / −0.02 em tabular-nums (CountUp).
- Brand gradient (`logo.svg` stops, tokens `--color-brand-*` in `theme.css`):
  - Full gradient (cyan → royal → indigo → violet → purple → magenta) only on: h1 rotating word (text clip), Rivet bars in charts, primary command box 1 px border on focus. Nowhere else.
  - Hero glow: 2 stops (cyan, violet) at ≤ 18 % alpha light / 28 % dark, one radial blob behind the h1, no animation before interaction (static gradient; a 40 s `background-position` drift allowed only if CSS-only and paused under reduced motion).
  - Icons: `--color-brand-royal` light / `--color-brand-cyan` dark; everything else neutral.
  - Budget: gradient pixels ≤ 10 % of any viewport; never gradient text in body copy, never gradient buttons.
- Spacing: 8 px base; section padding 128 px desktop / 72 px mobile; content measure 640 px for prose; grid gap 32 px desktop / 20 px mobile.
- Surfaces: no boxed cards for content or charts (hairlines + whitespace); only the showcase `.ui-stage` and code windows have a surface (they ARE components / editors). No drop shadows except the HeroUI component defaults inside the stage.
- Light / dark: both first-class, follow `data-theme` (docs-kit toggle) and `prefers-color-scheme`; background light `#fbfbfd`-ish token, dark near-black `--color-bg` from theme; competitors' bars and hairlines use `color-mix` on `--color-fg` so they adapt. Contrast ≥ 4.5:1 for all text incl. muted captions (verify both themes in T11).
- Imagery: none — no photos, no AI images, no illustrations. Visuals = real numbers, real compiler output, real components.
- Icons: lucide only via `@rivetjs/kit/icon`; never hand-drawn SVG, never UTF glyphs (no ✓ × → ★ in copy — use lucide `Check`, `X`, `ArrowRight`).
- Motion principles: motion explains (word cycle = 4 proofs; bars = comparison; readout = what loaded); ≤ 1 autoplaying element (headline) and it stops; everything else in-view or on interaction; `transform` / `opacity` / `filter` only.

## 5. Build plan (lane HOMEPAGE; each task ≤ 1 h; `export PATH=…node v26.5.1…` first)

Gates for every task: `NX_DAEMON=false npx nx run docs:typecheck --output-style=static --skip-nx-cache`, `npx vitest run --project docs` (memory caps: `--maxWorkers=2`, `NODE_OPTIONS=--max-old-space-size=2048`), `npx prettier --write <touched files>`; update `apps/docs/CLAUDE.md` landing bullet in the same commit.

1. **T1 deps + styles + baseline**: add `@rivetjs/ui` (+ `tw-animate-css` if needed) to `apps/docs/package.json`; scoped ui CSS imports in `apps/docs/src/styles.css` (copy list from `apps/ui-docs/src/styles.css`, only components used); `export const preload = { background: 0 }` (or router option per `/`) in `apps/docs/src/routes/index.tsx`; record baseline bytes (HTML, loader, JS before input) of the current home via `npm run size-report -- --apps=docs-home` (add the app entry if missing) → numbers into the commit message. Check `HeroGlow`: if it loads a module before input, replace with CSS gradient. Test: docs build, `site.test.ts` still green.
2. **T2 `_charts.ts` exports**: `homeStrip` (3 charts: points + computed big ratio + footnote values: SSR 5000 ratio, first-click tie, React ratio), `editorialLoss` (import `docs/benchmarks/2026-10-11-editorial.json` with JSON import attribute), feature-grid numbers (streaming p99). Files: `apps/docs/content/_charts.ts`, `apps/docs/tests/charts.test.ts` (each new value equals the JSON; ratios ≥ the report verdict thresholds). Test: vitest docs.
3. **T3 `RotatingWords`**: `apps/docs/src/components/home/RotatingWords.tsx` + CSS in `apps/docs/src/home.css` (keyframes, pause checkbox, reduced motion, inline-grid slot). Test: `apps/docs/tests/home.browser.test.ts` (new, Chromium on the built site): (a) first paint shows "fast." and the h1 accessible name is the full sentence; (b) after 2.7 s word 1 visible (`getComputedStyle(opacity)`), (c) h1 box size unchanged across 4 words (CLS 0), (d) `emulateMedia({ reducedMotion: "reduce" })` → no running animations (`document.getAnimations().length === 0`), static list visible, (e) pause checkbox → `animationPlayState === "paused"`, (f) ends on "yours." after 2 cycles (fast-forward via `document.getAnimations().forEach(a => a.currentTime = …)`).
4. **T4 Hero section**: rewrite hero in `apps/docs/src/routes/index.tsx` (eyebrow Chip, h1, sub, command box with `CopyButton`, Button "See the numbers", text link) + `home.css` hero rules desktop/mobile; delete old claim pills / clone line (move clone instructions to quick start only if not already there — grep `apps/docs/content/start/quick-start.md`). Test: browser test copy button writes `npm create rivet@latest` to clipboard (Playwright clipboard permission), no horizontal scroll at 375 px.
5. **T5 Numbers strip**: `apps/docs/src/components/home/CountUp.tsx`, `BarList.tsx`, section in `index.tsx`, loss row, `Disclosure` with `BenchGrid`; remove `BenchProof` from home (keep component for `about/benchmarks.md`). Update `site.test.ts` home assertions (loss row present with the editorial numbers, every chart links to its report, numbers in HTML equal `_charts.ts`). Test: browser test reduced-motion shows final values; `@supports` fallback renders final values (run with `animation-timeline` stripped via injected style).
6. **T6 Resumability demo**: `apps/docs/src/components/home/ResumeDemo.tsx`, `apps/docs/content/_home-demo.md` (compiled fence → fragment), section markup. Test (browser, production build, cold cache, `page.route` counting requests): before click, script requests = 0 beyond the document (inline loader only); click → exactly the demo chunk(s) requested, readout shows their names and byte counts matching the network log ±0; "Rendered on: server" after 3 clicks; with `slow 4G + 4×` CDP throttling first click → paint ≤ 100 ms (loose CI bound; resume-bench is the real number).
7. **T7 Feature grid + AI section + get-started + closing CTA**: markup + CSS in `index.tsx` / `home.css`; reuse `home-sample` fragment; MCP snippet via a fragment from `guides/tooling/ai.md` content (no retyped config). Test: `node libs/docs-kit/cli.ts check-content docs --strict`, `check-snippets docs`, every href resolves (site.test link check).
8. **T8 UI showcase**: stage in `index.tsx` with ui `Switch`, `Slider`, `ToggleButtonGroup`, `Select`, `Button`, `Meter`, `Chip`, `Surface`; intent preload. Test: browser — before interaction no ui chunk requested; hover Select trigger → its closure prefetched; open via keyboard (Enter) → listbox has focus, Escape closes and restores focus; axe check on the stage (`@rivetjs/testing` browser harness a11y helper if present, else axe-core in the test).
9. **T9 Footer numbers**: `apps/docs/content/_home-perf.json` (schema: date, html bytes, loader bytes, js-before-input bytes, lighthouse score/lcp/cls/tbt), footer line, "Measure my visit" handler. Test: unit test the formatter; browser test click → readout has TTFB/LCP/JS numbers and JS-before-click equals the network log.
10. **T10 Lighthouse + perf script**: `apps/docs/scripts/home-perf.ts` (new): build docs, serve `dist` with `apps/editorial-bench/harness/static-server.mjs` (gzip), `runLighthouse()` from `apps/editorial-bench/harness/lh.mjs` × 3 (median) with the Playwright Chromium path, plus a Playwright Fast 3G + 4× run (CDP `Network.emulateNetworkConditions` 562.5 ms RTT, 1.44 Mbit/s) measuring LCP, `LCP − responseStart`, CLS, JS bytes before input; writes `_home-perf.json` (`--check` mode compares against the bar below). Run under the CPU gate (memory cpu-gate), ≤ 3 GB RSS.
11. **T11 polish + docs follow code**: dark/light contrast check (both themes screenshots, mobile + desktop), `apps/docs/CLAUDE.md` landing bullet rewritten, `llms --check` (`node libs/docs-kit/cli.ts llms docs --check`; home is in llms outputs if it is a content page — regenerate), `npm run format:check`, `NX_DAEMON=false npx nx run docs:build`, size report `--check` (home route bytes delta in the commit), commit `feat(docs): new landing page on @rivetjs/ui` + trailer, explicit paths only.

Acceptance bar (T10 measures, T11 blocks on it):

- Lighthouse mobile (13.5, simulated slow 4G + 4× CPU) performance = 100, 3/3 runs; LCP ≤ 1.05 s (= Astro's article LCP in the editorial run; the current Rivet article is 1.20 s), TBT 0, CLS 0.
- Fast 3G + 4× CPU (Playwright, cold cache): `LCP − responseStart` < 1 s and CLS 0. Note: absolute LCP < 1 s on Fast 3G is not reachable from a cold connection (562.5 ms RTT × DNS + TCP + TLS + request ≈ 4 RTT ≈ 2.2 s before the first byte); the bar is stated relative to first byte and as absolute with a pre-warmed connection (`preconnect`-equivalent: second navigation on the same origin), both reported.
- Client JS before the first interaction: inline resume loader only (0 module requests, 0 prefetches) — asserted by the T6 / T10 network log; HTML of `/` ≤ 40 KB raw / 12 KB br.
- Rotating words: CSS-only, stops after 2 cycles, pausable, static under reduced motion (T3 tests).
- Demo: real chunk names + bytes, "rendered on server" survives clicks (T6).
- Every number on the page traceable to a committed JSON via `_charts.ts` / `_home-perf.json` (`charts.test.ts`).

## Rulings (coordinator 2026-10-11, replace the open questions)

- Rotating words: "fast. / resumable. / dynamic. / yours.". "dynamic" = per-request SSR from the fair comparison, labelled "dynamic rendering": Rivet vs the Qwik / Solid resumable-page bars, plus the honest plain-hydratable-Solid loss with one line on what is being done (Function Bridge + row ABI lanes). Razor stays in the static-page chart. No new ssr-bench run for the homepage.
- "accessible" → feature grid, proven by cdk a11y test counts.
- Hero shows `npm create rivet@latest` with the "Pre-release · npm publish pending" chip (2026-10-12; was: no badge).
- HeroGlow: CSS only. Nothing but the resume loader runs before interaction — the page is the proof (T1: docs-kit `site.leanPages` + router `preload.lean`, fragments coloured at build; home 73 scripts / 186 KB gzip → 0 before input).
- LCP: relative-to-first-byte target + warm absolute number accepted; Lighthouse LCP ≤ Astro's 1.05 s, score 100, CLS 0.
- Motion: CSS for everything before interaction; kit `<Transition>` for click-triggered motion until `@rivetjs/motion` lands (T1 scaffold, CSS entrances only).
