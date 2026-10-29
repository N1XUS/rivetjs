# ROUTER-PRIME: the idle prime runs the router's `Root.ready` (2026-10-29)

Base 1ae4677e7 (A) vs ROUTER-PRIME (B). Chrome 156.0.8078.48 headless, macOS, Apple M4 Pro, Node 26.5.1. Host shared with other lanes; load1 noted per row. Every cell: median (min–max), A and B interleaved in random order, fresh context, cache disabled.

## Change

- Before: LITE-BOOT's idle prime (`rt.w(document)`) loaded the listening records' chunks but skipped `prepare` / `ready`: the router's generated `Root.ready` imports the shown URL's page module, which was not on the fetch-ahead list (`data-fo`). A primed router page's first press therefore still waited for that `import()` (+1 request after input, replayed after the next frame; on Slow 4G a full round trip).
- Build (option B of the ruling): `rivetRouter()` sets the compiler's `resume.ready` (`{ root: ".rivet/app.tsx#default", routes: route id → page file }`); the resume manifest gets `ready: { root, routes: route id → page chunk + static closure }`.
- Server: `createApp` passes `preload.route` for a listed route; `server-derived.ts` `readyOf` adds those URLs (+ the built-in decoders' chunk when the payload table names it) to `data-fo` when the root record ships and is fetched ahead, and writes tail `p` = the root record's id.
- Browser: the prime also runs `prepare` (`ready`) for the record `p` names, quietly (a failure resets `ready`; the first event runs it again). Every module it imports is already a modulepreload: no request of its own. Other roots' `ready` hooks (docs-kit `FrameRoot`) stay unprimed.

## Router fixtures (A/B, first trusted mouse click 1.5 s / 3 s after load)

Harness `scratchpad/rprime-tools/ab.ts` (LITE-BOOT `frame-ab.ts` over the router node adapter, ports 4600+): mutation = first DOM change after the click, paint = rAF + MessageChannel after it, CPU = CDP `TaskDuration` before the click, JS = CDP `encodedDataLength` of JS responses before the click, after = JS requests sent after the click; the expected text checked every run (no failures, no page errors). `fast` = unthrottled, `slow` = Slow 4G (150 ms, 1.6 Mbit/s) + 4x CPU.

| page / condition | n | paint A | paint B | mutation A | mutation B | CPU before input A | B | JS before input A → B | after A → B | load1 |
|---|---|---|---|---|---|---|---|---|---|---|
| example:nested-layouts `/` `#cart`, fast | 7 | 31.4 (30.4–33.3) | **15.7 (13.0–17.0)** | 16.3 | **2.8** | 14.2 | 14.1 | 38,208 B / 6 → 38,897 B / 7 | 1 → 0 | 5.2–5.8 |
| example:nested-layouts, slow | 7 | 180.9 (179.0–181.4) | **14.2 (13.7–16.6)** | 176.4 | **12.4** | 55.0 | 55.6 | same | 1 → 0 | 5.4–6.1 |
| kit-fixture `/` layout button, fast | 7 | 31.2 (30.0–34.0) | **14.7 (3.1–15.6)** | 16.6 | **2.7** | 11.2 | 11.3 | 42,672 B / 9 → 43,650 B / 10 | 1 → 0 | 4.9–6.0 |
| kit-fixture `/`, slow | 7 | 180.0 (171.9–197.8) | **17.5 (14.9–33.0)** | 175.2 | **12.2** | 48.7 | 48.2 | same | 1 → 0 | 5.2–7.9 |
| kit-fixture `/about`, fast | 5 | 32.2 (30.6–33.0) | **14.7 (14.0–15.7)** | 17.0 | **2.8** | 11.7 | 12.0 | 42,228 B / 8 → 43,441 B / 9 | 1 → 0 | 8.1–8.3 |
| kit-fixture `/about`, slow | 5 | 181.5 (178.5–182.4) | **15.7 (14.0–16.7)** | 175.1 | **12.8** | 51.8 | 52.2 | same | 1 → 0 | 7.1–7.8 |

- The page chunk moves from the first press to the idle list: +1 low-priority request before input (+0.7–1.2 KB transfer), 0 requests on the first press (size report `example:nested-layouts` 1st req 1 → 0).
- CPU before input unchanged within noise (the page module is a few hundred bytes; `ready` resolves from the module map).
- Runtime: `dom-derived-runtime` +130 B min / ~+50 B br (`primed`, tail `p` check); server: `readyOf` runs only on a listed route.

## Commands

```sh
npm run size-report -- --apps=example:nested-layouts,kit-fixture --no-lanes   # per side; dists copied out of .artifacts/size-report/apps and libs/kit/tests/fixture/dist
node rprime-tools/ab.ts --dirs A=…/A-nested,B=…/B-nested --path / --click '#cart' --expect '#cart=Cart: 1' --repeats 7
node rprime-tools/ab.ts --dirs A=…/A-kit,B=…/B-kit --path / --click button --expect 'button=Clicks 1' --repeats 7
node rprime-tools/ab.ts --dirs A=…/A-kit,B=…/B-kit --path /about --click button --expect 'button=Clicks 1' --repeats 5
```
