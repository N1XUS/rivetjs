# Speed round 2026-10-07

Same-session runs on one quiet host (Apple M4 Pro), Rivet at `d9aa5826`+. Medians (min–max); ms unless noted.

## Findings

- **DOM 1000-row mount "regression" was a harness change**, not code: `26f26ffc` cross-origin-isolated the dom-bench page (5 µs timers); every lane reads ~12% higher since. HEAD with isolation off = 17.7 ms (pre-change 17.4). Scoreboard "loss" = cross-day drift vs stored 2026-10-06 competitors.
  - Same-session run.ts 1000 rows: Rivet 18.7, Solid 1 18.8, Solid 2 20.0. 5000 rows (8 interleaved repeats): Rivet 90.3–92.8, Solid 1 90.8–93.6.
- **Chrome first-mouse-click stall**: a synchronous DOM change inside the first trusted mouse `click` in a tab stalls the next frame ~25–45 ms (main thread silent in `BeginMainFrame` until the hover-update mousemove). Bare page, no framework: sync write 47–63 vs deferred one task 24–32. Keyboard Enter 1 ms, touch ~32 — no stall. Later clicks don't stall. Qwik avoided it only because its handlers run async.
  - Fix (`d9aa5826`): `_dispatch` defers the reactive flush one task for the first trusted mouse click per document only (deferring every click made later clicks one frame slower: headless 16 → 33). See `docs/guides/resumability.md` "First mouse click".
  - resume-bench now reports `click` (mouse), `keyClick`, `tapClick` (`2e8c0ce3`).
  - Real mouse (headed Chrome, 12 alternating human clicks, first click per fresh tab): sync 12–69 (median ~50) vs deferred 17–21.
  - Navigations (content replaced under the pointer) defer too since 2026-10-08: Chrome stalls the frame after the hovered element is detached, so dom-v2 hides it (`display:none`) and removes it next rAF (`_deferredFlush()`). resume-bench slow (Chrome 154, 4x CPU, 10 reps, host load ~6-9), paint p50 HEAD -> change: navigate 48.8 (46-72) -> 39.8 (39-56) vs Qwik 55.8; click 32.3 -> 33.2, keyClick 9.7 -> 9.5, tapClick 31.5 -> 32.1 (noise).

## Resume (resume-bench, slow = Slow 4G + 4× CPU, 5 repeats, input → paint)

| scenario | Rivet | Solid 1 | Qwik 2 |
|---|---|---|---|
| click (mouse) | **32.4** (32–33) — was 59–61 | 56.5 (48–70) | 32.1 (31–34) |
| keyClick | 13.9 (10–17) | 12.1 (8–15) | 22.9 (22–33) |
| tapClick | **31.4** (30–32) | 31.4 (31–33) | 49.4 (48–50) |
| filter | **72.4** (61–91) | 74.4 (72–90) | 130.1 (126–138) |
| navigate | 78.4 (74–88) | 182.9 (182–189) | 56.8 (53–93) |

- navigate is noisy for Qwik 2 across runs (56.8 here; 91.8–97.5 in an A/B the same hour). Rivet navigate before/after the defer: 68.7 (61–94) vs 76.8 (56–103) — overlapping ranges; handler mark +6 ms (DOM write one task later).

## Resumable SSR (ssr-bench Docker, c1, duration 10, warmup 3, 3 repeats, GC tuned; frontend CPU ms/response, peak MiB, p50 ms)

| rows | lane | CPU | peak | p50 |
|---|---|---|---|---|
| 1000 | rivet-resume | **5.93** (morning 7.54) | 197 (266) | **5.48** (6.57) |
| 1000 | solid-stable-interactive (like-for-like) | 6.38 | 162 | 6.10 |
| 1000 | Solid 2 hydratable (no handlers/links/data) | 3.59 | 125 | 2.93 |
| 1000 | Solid 1 hydratable (same) | 2.36 | 135 | 3.04 |
| 5000 | rivet-resume | **30.0** (41.0) | 192 (276) | **29.2** (40.0) |
| 5000 | solid-stable-interactive | 35.4 | 193 | 37.0 |
| 5000 | Solid 2 / Solid 1 | 20.0 / 14.3 | 144 / 160 | 18.5 / 13.0 |
| 100 | rivet-resume | 1.11 | 163 | **0.94** |
| 100 | solid-stable-interactive | 1.06 | 101 | 2.41 |

- `solid-stable-interactive` (`102a5068`): Solid 1.9 hydratable doing rivet-resume's work (onClick per row, signal-driven attribute, per-row link, nested layout state, seroval page data). Rivet now beats it on CPU and p50 at 1000/5000; peak memory still higher at 100/1000.
- Changes: node adapter direct writes (`06485775`), null attribute slots + bare server Link (`2bd6b83c`), packed For rows (`35ba5226`), encoder micro-opt (`61823d9f`). Compiled resumable rows (`$rows`) dropped (`afb03c49`): never activated on realistic rows.

## Static SSR (unchanged lead)

rivet-compiled 1000 rows CPU 0.83 / p50 0.89 / peak 87 MiB vs Razor 1.83 / 1.27 / 115 (stored 2026-10-06) and solid-stable-static 1.34 / 1.26 / 146.

## Open

- Resumable SSR vs plain hydratable Solid (no handlers/data): ×1.6–2.5 CPU; peak memory ×1.2–1.6.
- Qwik 2 navigate variance (53–97 across runs).
