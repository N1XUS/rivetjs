# Preload background budget (lane PRELOAD-VISIBLE, 2026-10-11)

Planner `preload.background` (`libs/runtime/server-resume.ts` `planPreload`, loader `P` entries). Guide: `docs/guides/resumability.md` "Preload planner".

## Setup

- ui-docs production builds (`node libs/docs-kit/cli.ts build apps/ui-docs --no-checks --no-search`), static bench server (lane harness `bench.mjs`): HTTP/2 + TLS + brotli (headline) and HTTP/1.1 (6 connections).
- Chromium cold, 1280×720; throttled = 4× CPU + Fast 3G (562 ms RTT); latency = first interaction → its DOM effect; n = 5, median.
- Bytes: scripts + KB (brotli) fetched before the first input (load + quiet), unthrottled, h2.

## Problem

- `visible` = IntersectionObserver only: a below-the-fold widget's closure (Select ≈ 80 modules / 97 KB br) loaded after scrolling to it. /themes below-fold Select first open: 4.4 s (h2) / 10.9 s (h1) viewport-only vs 0.6 s prefetched.
- Unbounded idle background prefetch of every `visible` chunk fixed that, but over-fetched on docs pages with many example frames (each frame plans its own document): /components/button 73.5 → 393 KB, /components/select 241 → 1,078 KB.

## Ruling

- Budget = public option `preload: { background }` (bytes, minified closure; default 1 MiB; `0` off; router: number or `(url) => number | undefined`). docs-kit frames pass `0` (`framePreload`); /themes keeps the default.
- Reasons: background is idle-time, low priority (≤ 2 in flight, `fetchpriority=low`), Save-Data / 2g off — the cost is bandwidth after idle, not latency; docs frames are a docs-site artefact, not a product case; no iframe heuristics in the runtime.
- Cost if wrong: an app with > 1 MiB of below-fold closures fetches up to 1 MiB after idle (tunable).
- Rejected: 192 KB default (/themes needs ~1 MB in plan order for all 6 Select chunks; cheapest-first does not help); build-time chunk merging (Select closure 91 → 46 files but 110 → 166 KB; /themes 391 → 772 KB; one cdk+ui chunk: button page 89 → 495 KB).

## Bytes before first input (h2, brotli, HEAD 3e19d87c vs HEAD + lane)

| Page | head | lane |
| --- | --- | --- |
| /components/button | 27 scripts / 73.7 KB | 86 / 131.9 KB |
| /components/select | 142 / 192.0 KB | 201 / 250.1 KB |
| /themes | 386 / 473.6 KB | 359 / 440.6 KB (ThemeBuilder leaves) |

- The docs-page delta (+58 KB) is the site chrome's MobileMenu (cdk Button `pointerover` → `visible`), hidden on wide screens, now fetched at idle. `export const preload = "intent"` removes it but drops the mobile viewport prefetch; left as is.

## Latency (throttled, median ms)

Earlier lane run (base cfa49b26, load 3.5–23; head = base, bg = unbounded background, full = bg + ThemeBuilder leaves):

| Target (h2 / h1) | head | bg | full |
| --- | --- | --- | --- |
| /themes below-fold Select | 1195 / 1971 | 595 / 598 | 594 / 599 |
| /themes in-view tab | 722 / 690 | — | 722 / 684 |
| DatePicker page | 907 / 2478 | — | 903 / 2480 |
| chat example | 609 / 640 | — | 609 / 644 |

HEAD 3e19d87c vs HEAD + lane (1 MiB budget, frames `0`, ThemeBuilder leaves), bench lock, load at start of each target 3.4–8.7 (h1 in-view / DatePicker / chat ran at 18–23: indicative):

| Target (h2 / h1) | head | lane |
| --- | --- | --- |
| /themes below-fold Select | 626 / 1098 | 593 / 586 |
| /themes in-view tab | 711 / 689 | 712 / 688 |
| DatePicker page | 894 / 2481 | 900 / 2479 |
| chat example | 617 / 626 | 617 / 627 |

- Gate: no target worse than 10%; below-fold −5% (h2) / −47% (h1). HEAD's h2 below-fold improved since cfa49b26 (1195 → 626) without this lane; h1 stays request-count bound until the background prefetch.

## Structural reader prefetch (hybrid-resume branch idea → deps modules, STRUCT-PREFETCH)

- Idea: when an interaction loads a handler chunk, also fetch the static import closure (manifest `deps`) of it and of the structural readers it reaches, so `import()` does not walk a waterfall (modulepreload fetches one module).
- The planner already counts `"#"` region readers as handler extras; the missing part is the deps closure at interaction time.
- A/B on the HEAD build, cold (state `data-preload` stripped), DatePicker first open, throttled, n = 6 / 5, load 7–13: shim that modulepreloads every `deps` entry of each requested chunk vs none: h2 4,137 → 3,072 ms (−26%); h1 14,031 → 13,826 ms (−1.5%, connection bound).
- Warm pages (planner schedule present) do not hit this path for planned chunks (DatePicker 894 ms); intent-only chunks do.
- Landed as deps modules (lane STRUCT-PREFETCH, 2026-10-12): the build writes `<chunk>.deps.js` (`export default [urls]`, the static closure; `[]` for a chunk without imports) next to every symbol chunk and the runtime; the state script carries ` data-deps`; the loader imports a chunk's deps module when it hints that chunk for an interaction (or boots the runtime), then hints the closure (urgent, never evaluated alone).
  - Gated: only before the runtime started (the cold window) and not over HTTP/1.1 (`nextHopProtocol`).
  - Loader 2,236 → 2,329 B brotli (+93 B; keys variant 2,294 → 2,377 B). HTML per page +128 B raw (loader + ` data-deps`). ui-docs: 3,350 deps modules, 5.1 MB raw, none fetched before intent.
  - Bytes before first input (h2, unthrottled): /components/button 133.0 → 133.0 KB, /components/select 251.2 → 251.2 KB, /themes 441.2 → 441.2 KB (scripts 87 / 203 / 360 both).
- Rejected first: a site-wide chunk-graph module fetched at idle (64 KB br on ui-docs, 4,978 chunks; every example frame fetched it: /components/button 133 → 942 KB before first input).
- Variants measured (cold = state `data-preload` stripped):
  - ungated: cold h2 DatePicker −29%, Select −24%, /themes below-fold Select −38%, but warm DatePicker h2 +18% (~20 deps requests compete with the chunks the click needs) and every h1 row worse (warm DatePicker +70%, cold +11–13%, chat +81%);
  - cap of two deps modules per page: cold DatePicker +7% (later chunks' closures matter) — rejected;
  - shipped (runtime not started, not h1): table below.

HEAD cd65128f vs HEAD + lane, ui-docs, throttled 4x CPU + Fast 3G, n = 5 interleaved, median ms, bench lock (load at start of each target 2.5–8.9):

| Target | h2 head | h2 lane | h1 head | h1 lane |
| --- | --- | --- | --- | --- |
| DatePicker warm | 900 | 904 | 2471 | 2474 |
| Select warm | 596 | 593 | 591 | 593 |
| chat warm | 619 | 618 | 636 | 635 |
| /themes in-view tab warm | 714 | 712 | 695 | 694 |
| /themes below-fold Select warm | 587 | 591 | 584 | 590 |
| DatePicker cold | 4195 | 2974 (−29%) | 14191 | 14215 |
| Select cold | 3428 | 2600 (−24%) | 12881 | 12899 |
| chat cold | 643 | 647 | 663 | 661 |
| /themes below-fold Select cold | 4706 | 4699 | 14614 | 14653 |

- Gate: in-view / warm within noise (≤ 1%) on h2 and h1; cold h2 wins where the click lands before the runtime started. /themes below-fold cold: the page boots its runtime at idle (`data-boot`), so the click is past the cold window — unchanged.
