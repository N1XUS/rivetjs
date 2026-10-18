---
title: "I wrote a JS framework to beat ASP.NET. The first question was whether it runs React."
published: false
description: "Rivet, twelve days in: the fastest SSR I could build became a host for the framework you already have. A React 19 dashboard on Next 16 vs the same components as islands inside Rivet, every LOSE included."
tags: javascript, react, webdev, performance
cover_image:
---

<!-- image: cover (prompt suggestion in README "Cover") -->

## Previously

Two years ago my team had to pick a stack for a server-rendered product: ASP.NET Razor, or a JavaScript framework with SSR. I wanted the JavaScript one. We benchmarked the same list page on the same box, and Razor won every metric we'd written down: CPU per page, TTFB, median and p99 complete time, memory. We shipped .NET. It was the right call, and I have been quietly unpleasant about it ever since.

So I built Rivet: a Rust/oxc JSX compiler that turns components into flat byte plans for the server, fine-grained signals, compiled DOM templates, and resumable pages that never re-run a component in the browser. With a coding agent doing most of the typing, it got to the point where it beats Razor on the page that lost us the argument. I drafted three posts about that. They never went out, and this one replaces them, because the project they describe isn't the project anymore.

## Nobody asked about Razor

When I showed people the benchmark, nobody asked how the list tape works or why the Rust renderer spike died. The question that kept coming back was not about any of that. It was "Cool. Can I keep my React components?"

Fair. Nobody is going to rewrite their TanStack Table, Radix dialog and react-hook-form + zod form in a framework that's twelve days old. (First commit 2 October; 1,547 commits since, 1,486 of them co-authored by Claude. The agent still doesn't sleep.) "Just rewrite it in my framework" is the most popular sentence in frontend that nobody has ever acted on.

So Rivet became a host. "A JS framework nobody asked for" now pitches itself as "the one that runs the framework you already have". Same compiler, same streaming server, same resumability, and your React components inside it as islands. This post is about whether that's actually faster than just using Next, measured the same paranoid way as before, LOSE column included.

## What a bridge is

A bridge is an adapter that makes another framework's components usable as JSX tags in Rivet. On the server the component renders through that framework's own SSR (for React: `renderToString`, falling back to the stream API when something suspends) straight into Rivet's stream. In the browser it hydrates when its `client` policy says so: `load`, `idle`, `visible`, `interaction`, `media:(query)`, `intent` (hover, focus or touch, with the first click replayed after hydration) or `only` (client-only, with a fallback). No policy means static: React renders it on the server and it ships zero JavaScript. Props are live, so a Rivet signal updates the island through React's `root.render`. Rivet content can go into React slots. A function prop calls back into Rivet through the Function Bridge, so a React `onChange` can write a Rivet signal and the Rivet DOM is updated by the time the call returns.

Here's a Rivet route with a React chart in it:

{% gist GIST_URL_22 %}

The KPI cards are Rivet and ship no JavaScript. `RevenueChart` is an ordinary React component, recharts and all. It lives in a `.react.tsx` file so the build knows who owns it:

{% gist GIST_URL_23 %}

And the config:

{% gist GIST_URL_24 %}

It's `client="visible"` rather than Astro's `client:visible` because a namespaced attribute would have needed compiler work and couldn't carry options. A plain prop is typed and takes an object form: `client={{ on: "visible", rootMargin: "200px" }}`.

One more piece matters below. If a page's only client code is framework islands with JSON props, the server skips Rivet's resume state and loader and writes island records plus a 790-byte (brotli) inline boot that applies the policies itself. File-router pages still need Rivet's router for the first client navigation, so there ("D-lean") the router's state ships deferred: nothing runs until the first link hover, focus or click, and a cold click is held and replayed.

## The demo

One React 19 dashboard, three routes:

- `/`: KPI cards, recent orders, a recharts revenue chart.
- `/orders`: TanStack Table over 500 orders, with a Radix Dialog detail.
- `/orders/new`: a react-hook-form + zod form.

Two lanes. Same component sources, data, CSS and pinned library versions, with the rendered markup validated per route before anything is timed:

- **Next 16.4.0 App Router**: RSC for the static parts, one `"use client"` file per component, `next start`, rendering per request, `<Link>` with its default prefetch.
- **Rivet**: file routes with the same components as `@rivetjs/bridge-react` islands (table and form `load`, chart `visible`, user menu `idle`), document prefetch on.

Controls sit next to the headline in every table: every island on `load` (in case my policy choices were doing the winning), a no-prefetch pair for both frameworks, and Rivet with the old full resume driver.

The fairness fixes came out of review, as always. The first Next build used one barrel file of client components, so every route loaded all of them; now it's one file per component. The first Rivet build imported the order seed at module level, which resumed by reference and rebuilt 500 orders in the browser; now both lanes pass data as props from the server.

The conditions are part of the result:

- `NODE_ENV=production` everywhere, compression off on both servers, Node 26.5.1, one Apple Silicon host.
- A bench lock that's supposed to wait for load average < 4. The server phase gave up after the 45-minute wait and took the lock at load 4.25. The browser and Lighthouse phases were re-run on 13 October under the lock at 3.87, 3.64 and 3.89. The report is labelled **loaded host** and says "compare ratios, not absolute times". So do I.
- Browser: Playwright Chromium, fresh context per sample, n = 10 per lane and route, lanes interleaved, Fast 3G + 4× CPU and unthrottled, plus one warm-up visit with V8 precise coverage to tell "fetched" from "executed".
- Server: a closed-loop keep-alive client on localhost at c1 and c10, 3 rounds × 5 s, process-tree CPU from `ps`.
- Lighthouse 13.5.0, mobile preset, n = 3, on Playwright's headless shell because there's no full Chrome on the host. Simulated metrics only.

## Results

A verdict is WIN or LOSE only past the noise rules. Everything else is a TIE.

| comparison | WIN | TIE | LOSE |
| --- | ---: | ---: | ---: |
| Rivet vs Next (headline) | 73 | 26 | 23 |
| Rivet with every island `load`, vs Next | 75 | 25 | 22 |
| Rivet vs Next, both without prefetch | 71 | 38 | 13 |
| Rivet lean vs Rivet full driver | 11 | 101 | 10 |

The number I care about most is **framework JavaScript that runs before the first input**. Next runs 58.3 KB of framework chunks, plus 6.8 KB of client navigation code bundled into its user-menu chunk: about 65 KB on top of React. Rivet's headline lane runs 0.7 KB. (All sizes are gzip estimates.)

Total JS executed before the first input:

| route | Rivet | Next | ratio |
| --- | ---: | ---: | ---: |
| `/` | 170.1 KB | 239.0 KB | 0.71× |
| `/orders` | 95.0 KB | 162.3 KB | 0.58× |
| `/orders/new` | 93.2 KB | 160.6 KB | 0.58× |

I wanted the headline to be "half the JavaScript". It can't be, and the report says so: even with zero framework bytes, the floor is React plus the route's libraries. recharts alone is 101 KB on `/`. The same components cost the same bytes in both lanes, within 1.3 KB per category (Next ships its own vendored React build: 70.3 vs 66.9 KB). The only thing left to win on was the framework, and Rivet's share of that is down to 0.7 KB.

Script CPU until idle under Fast 3G + 4× CPU: 152.9 vs 977.9 ms on `/`, 71.4 vs 87.5 on `/orders`, 41.6 vs 81.4 on `/orders/new`.

Server, rendering per request: CPU per page is 2.0–4.9× lower than Next at c1 and 2.1–5.6× lower at c10. On `/orders`, the 500-row table, that's 1.57 vs 3.10 ms at c1. TTFB is 2.2–4.8× faster at c1 and 2.4–6.8× at c10. The islands are still rendered by React's own `renderToString`. Everything around them is compiled Rivet.

Lighthouse, mobile: **100 / 100 / 100** against Next's **81 / 84 / 96**. Simulated LCP: 923 vs 5,255 ms on `/`, 1,224 vs 4,557 ms on `/orders`, 902 vs 2,852 ms on `/orders/new`. One footnote: Next's own `/orders/new` LCP was 4,106 ms in the 12 October run and 2,852 ms on the 13th. The 3.2× on that route is against the lower number.

What didn't move is input-to-paint: sort click, filter keystroke, row to modal, form submit, all TIE under Fast 3G. After hydration it's the same React code handling the same events. Rivet can't make React's reconciler faster and doesn't try.

### The LOSE column

All 23 headline LOSEs, grouped, plus the one from the no-prefetch pair. The report hides none of them, and neither does this post.

**JS requests before input: 15 vs 7** on `/` and `/orders`, 14 vs 6 on `/orders/new`, under both network conditions. Ten of those fifteen are low-priority fetch-ahead modulepreloads of Rivet's runtime and router, fetched after `load` and never executed. The pure-lean lane makes 4 / 4 / 3 requests and wins this row. Grouping the fetch-ahead into fewer chunks would close the gap; not done yet.

**First client navigation.** With prefetch on, the first nav click matches Next on Fast 3G: 1,793 vs 1,731 ms, TIE. Without prefetch, Rivet loses badly: 3,284 vs 1,727 ms (1/1.90×). Nothing beyond the islands loads before intent, so the click itself pays for downloading the runtime and router, while Next without prefetch still has its router in memory. That's the trade the `prefetch` setting controls, and it's why the default is on. Unthrottled, the headline lane also reads LOSE: 49.8 vs 37.2 ms. The samples are bimodal, one frame apart (≈ 35 or ≈ 50 ms), and the full driver shows the same thing (45.1 ms) even though this change doesn't touch it. The previous day's run had 37.1 vs 37.6. I think it's frame quantisation. The report still counts it as a LOSE until a larger n says otherwise.

**Peak server RSS:** 615 vs 493 MB on `/orders` at c10, and 617 vs 493 and 425 MB on `/orders/new` at c1 and c10. One server process serves the routes in order, so the `/orders/new` peak probably carries over from the 500-row page at c10. The all-load and full-driver lanes read 497 and 520 MB there. "Probably" isn't proven, though, so all three LOSEs stay in the tally. On the same rows, per-request CPU is 2.1× cheaper and TTFB 2.4× faster. Next suspect: the 500-row page buffered for 10 concurrent requests.

**Page bytes.** Rivet's HTML is bigger on every route: 6.0 vs 2.3 KB gzip on `/orders/new`. Rivet inlines the site CSS plus the island records and the boot. Next links its CSS and streams the RSC payload. On `/orders` the totals are close (85 vs 90 KB raw) because Next's inline RSC payload is 83 KB of script against Rivet's 7 KB. On `/orders/new`, inline JS is 7.0 vs 5.5 KB raw: another LOSE.

**Unthrottled filter keystroke on `/orders`:** 14.0 vs 10.8 ms. The all-load control wins the same row at 7.0. The day before it was the other way round. 5–15 ms medians that swap between runs: noise at n = 10, counted anyway.

### And against Astro

The islands benchmark is a different page: a 1,000-row server-rendered list plus React islands on `load`, `idle` and `visible`. Rivet + `@rivetjs/bridge-react` vs Astro + React: 15 WIN / 15 TIE / 0 LOSE; vs Next: 23 / 7 / 0; the Preact pair vs Astro + Preact on the same Preact 10.29.8: 16 / 14 / 0. Bytes before input tie with Astro (78.6 vs 80.8 KB gzip): both are mostly React. Server CPU is 2.26× lower (0.23 vs 0.51 ms per page at c1). The same page as native Rivet components beats the React-island version on 13 rows. That's what React costs.

## The Lighthouse detour

The first lean client did the obvious thing: `<link rel="modulepreload">` tags for the `load` islands' chunks, fetched during parse. Fewer bytes, fewer requests, no runtime. I ran Lighthouse expecting a victory lap.

Scores: 83 / 88 / 92. Simulated LCP on `/`: **4,202 ms**. The full resume driver, with more JavaScript and more requests (the thing the lean client exists to replace), scored 100 with 921 ms. The less I shipped, the worse it rated.

The cause is how Lighthouse simulates. Lantern takes one unthrottled trace and replays it on a simulated slow network, and every request that *started* before the observed FCP or LCP goes into the simulated graph, whatever its priority. My preloads started during parse, so on simulated 4G the React vendor chunk sat on the first-paint path. `/` was sneakier. On a fast lab load, `load` and an idle slice can arrive *before* the first paint is presented, so the fetch-ahead preloads and the in-viewport `visible` chart's import also started before FCP. The full driver missed all of this by accident: it only reaches the island chunks after its own entry script.

Options, measured in the same lock window, n = 3:

- `fetchpriority="low"` on the link tags: 4,203 ms. Lantern counts low-priority requests too.
- A `requestAnimationFrame` gate: bimodal, 0.9 or 2.9 s on `/orders/new`. rAF plus idle still ran before the headless shell presented the frame.
- Wait for the real first `paint` performance entry, then one idle slice, before any preload or island import: **922 / 1,223 / 925 ms, scores 100 / 100 / 100.**

So the lean HTML has no link tags anymore. Each record carries its island's prefetch list, and the boot gates everything on the paint:

{% gist GIST_URL_25 %}

Then review turned "works in Chromium" into "works". No `paint` entry type, or no `PerformanceObserver`? The idle slice alone. A page that never paints contentfully (hidden until an island reveals it, an empty `only` shell, a 0×0 iframe), or Safari and Firefox, which only emit `first-contentful-paint`? A cap 1 s after `load`. The next review found that the cap was only armed by the `load` event, so a boot that ran after `load` never got one. It's now armed immediately when `document.readyState` is already `complete`, and an engine with an observer but no `supportedEntryTypes` no longer throws before reaching it. And someone who presses something before the gate opens shouldn't wait on a heuristic: an `interaction` island's first pointerdown or keydown opens the gate for everyone.

Cost: +174 B minified, +102 B gzip, +80 B brotli on the inline boot (now 790 B br); the paint gate itself was +16 B br, the fallbacks the rest. Hydration CPU and input-to-paint didn't move.

Lean vs the full driver is now a TIE on `/` and `/orders`. `/orders/new` is still a LOSE, 902 vs 771 ms, both scoring 100: the form island's chunks now start right after the first paint (41–57 ms into the diagnosis run, against an observed FCP of 32–41 ms), which is still close to the observed LCP. It's in the tally. Also unfixed: the headless shell isn't full Chrome, and an app with a big LCP image may behave differently.

The lesson isn't "Lighthouse is wrong". "Fetch less" and "fetch later" are different optimisations, and I'd only done the first.

## Resumability vs hydration, honestly

Resumability's pitch is "execute nothing until the user does something". The standard objection is "and then fetch thirty small chunks on the first click". So I measured whether Rivet should ship route-shaped chunks (hydration-style grouping, still zero execution before the first event) instead of per-component ones.

Cold click to popup visible on component-library example frames, median of 5:

- HTTP/1.1, Fast 3G: route chunks win by 494 to 1,452 ms (date picker: 10,400 → 8,948 ms).
- HTTP/2, Fast 3G: equal, 2 to 15 ms.
- Unthrottled, after preloads: equal, and the route build's click downloads no extra JS.

Route mode never regressed a cold click. It also never reached the ≤ 5 requests before input I was aiming for: the requests are the static import closure of the handlers, and a bigger merge budget cut them further (77 → 49 at 64 KB, bytes flat) than any grouping did. So the default stayed `component`, and route chunks are the documented recommendation for route-shaped apps. In one line: hydration-style chunks win on HTTP/1.1 and gain nothing on HTTP/2. If you're still serving HTTP/1.1 in 2026, your framework is not your biggest problem.

## The cold press

The hard part of resumability isn't the first paint. It's the click that arrives before the handler's code does.

Rivet's inline loader catches events in the capture phase, holds them, loads the chunk and replays them. On a slide that's "replay the click". In practice the browser has already moved focus on the cold `mousedown`, before the handler that would have cancelled it (a radio label, React Aria's `preventFocusOnPress`) exists. So when the chunk lands, the runtime puts focus back where it was at dispatch, replays the handlers so they see the focus state they'd see on a loaded page, and then lets the default focus follow unless a handler cancelled it. That last focus uses `focusVisible: false`. The first attempt held the default and focused from script, which turned on Chrome's `:focus-visible` heuristic for every later script focus on the page: focus rings after every mouse click. It was reverted the same day.

A press's `mousedown` and `pointerdown` are linked, so the focus-back runs once per press. A held link click replays as a copy of the user's event (`new event.constructor(type, event)`). `el.click()` produced `detail: 0` and `pointerType: ""`, which React Aria reads as a virtual (keyboard or screen reader) click, so a cold mouse click on a link drew a focus ring.

A cancelled press also records where focus was, so a later press queued in the meantime can walk back past it:

{% gist GIST_URL_26 %}

The first version of that walk kept one entry per element. Press A, press B, press A again, all cold, all cancelled: A → B → A → B, forever, on the main thread. Review caught it. Now each element keeps a list, and the walk moves strictly backwards in dispatch time (`e[2] < ts`), so it ends. There's a test with four cold presses whose chunks arrive 1.5 s late. I'd love to say I found that one myself.

## Fuzz

None of those cold-press rules came from me thinking hard. They came from a resume fuzzer: every story route of the two component libraries, loaded twice in Chromium (resumed from the server, and rendered in the browser after a client navigation), driven in lock-step (click, type, keys, Escape) and compared after every step: resume errors, page errors, re-created server nodes, normalised DOM including focus, value and checked state. Preloads are stripped from the resumed page, so every first interaction is genuinely cold.

First run: 179 routes, 4,313 steps. Zero `rivet:resume-error`, zero page errors, zero reloads. Not zero findings, though: re-created regions, server vs client attribute drift, mount-time effects that only run on a client render, and the cold-focus class above. Each real finding is pinned with an owner (30 pins on one app, 27 on the other), either as a `test.fails` that has to fail on every run until it's fixed, or as a `design` pin for an accepted difference.

The pin discipline is the useful part. A finding becomes an open pin only after three re-runs with identical results. Seen in one or two of three, it's timing: a narrow design pin with the measured rate in the note ("1 of 6"). Without that rule, a fuzzer is a slot machine that pays out in flaky tests.

## So, can you keep your React?

Yes. That's the whole pitch now.

The first release ships `@rivetjs/*` on npm, `npm create rivet@latest` with four starters, `@rivetjs/bridge-react` (React 19) and `@rivetjs/bridge-preact` (Preact 10.29+ and 11). Solid, Vue and Svelte adapters are next. The release pipeline already publishes end to end to a local registry, and every starter builds, checks and serves from it. The public npm publish and the repo are coming soon.

I'm not after stars. I want ten real users: people with a React app and a page that's slower than it should be, who'll drop their components into a Rivet route and tell me what broke. The API still breaks whenever a benchmark says it should, and the design docs say that stops once there are real users. I'd like it to stop.

---

_Every number here comes from three reports in the repo's `docs/benchmarks/` (bridges demo, islands, route chunks) and the resume fuzz results in its design specs. They were measured on one Apple Silicon host that was busier than I'd like. They describe one implementation on one machine, not a ranking of frameworks. The LOSE column above is complete as of 13 October._
