# Code block cost on heavy docs pages (2026-11-01)

Question: can a page with many highlighted code blocks get cheaper by changing how the blocks ship? Chromium headless (Playwright), CPU 4×, 1280×800, medians, one host, nothing else running. Scripts were throwaway.

## Isolated blocks only (58 blocks of `/components/scheduler`, no site CSS, 9 runs)

| Variant | Load CPU | Scroll CPU | Total | DOM nodes | Brotli |
| --- | --- | --- | --- | --- | --- |
| Spans (today) | 124 ms | 168 ms | 292 ms | 21 247 | 8.9 KB |
| Spans + `content-visibility: auto` | 71 ms | 185 ms | 255 ms | 21 247 | 8.9 KB |
| Text + CSS Custom Highlight API, all ranges at load | 104 ms | 136 ms | 240 ms | 130 | 10.2 KB |
| Highlight + `content-visibility` + ranges on intersection | 59 ms | 415 ms | 474 ms | 130 | 10.4 KB |

## Real production pages (ui-docs dist, 7 runs)

| Page, variant | Load CPU | Scroll CPU | CLS | DOM nodes |
| --- | --- | --- | --- | --- |
| scheduler, base | 701 ms | 1657 ms | 0.0003 | 33 490 |
| scheduler, `content-visibility` on `.code-block pre` / `.code-panel pre` | 696 ms | 1664 ms | 0.0092 | 33 500 |
| autocomplete, base | 610 ms | 1529 ms | 0.0014 | 47 734 |
| autocomplete, `content-visibility` | 609 ms | 1496 ms | 0.087 | 47 744 |

| Page, variant (separate run) | Load CPU | DOM nodes |
| --- | --- | --- |
| scheduler, base | 710 ms | 31 663 |
| scheduler, bodies of hidden `<pre>` removed | 671 ms | 12 224 |
| autocomplete, base | 633 ms | 47 589 |
| autocomplete, bodies of hidden `<pre>` removed | 602 ms | 8 355 |

55 of 58 and 81 of 87 `<pre>` were not rendered at load. Removing them is a ceiling: no lazy fetch was built or paid for, and the code tabs were not exercised.

## Conclusions

- The isolated numbers did not predict the real page. Always confirm on a production page.
- `content-visibility` rejected for docs code blocks: no CPU gain on real pages (most blocks are already hidden) and CLS rises to 0.087.
- Highlight API is not a speed win worth its cost (+15 % bytes, JS needed for any colour); its gain is DOM node count. Not adopted.
- Lazy hidden code cuts nodes 60–82 % but CPU about 5 %. Worth doing only if DOM memory becomes the target (memory was not measured).
- Code blocks are not where these pages spend load CPU. The example frames are.

## Example frames (follow-up, 2026-11-02)

Trace of `/components/scheduler`: 18 example iframes with `loading="lazy"`, none in view at load, yet Chromium loaded 4 (its lazy threshold is 1250–2500 px), each parsing its page and starting its fetch-ahead: 317 script requests (83 unique, 145 KB brotli) before any input.

| Page | Variant | Load CPU (4×) | JS heap | Script requests |
| --- | --- | --- | --- | --- |
| scheduler | native `loading="lazy"` | 810 ms | 12.5 MB | 327 |
| scheduler | IntersectionObserver, 600 px margin | 427 ms | 6.8 MB | 4 |
| button | native | 625 ms | 7.0 MB | 62 |
| button | IntersectionObserver, 600 px margin | 426 ms | 6.2 MB | 7 |

Cost: after a jump to a far demo it appears ~80–135 ms later (native: 0–150 ms, depending on whether it had preloaded). Adopted in docs-kit (`PARENT_LAZY_FRAMES`); measured by rewriting the shipped HTML, 7 runs, medians.
