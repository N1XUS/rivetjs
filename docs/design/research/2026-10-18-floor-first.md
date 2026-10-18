# Floor-first: the physical limits per axis, and the stack that reaches them (2026-10-18, round 3)

- Status: research + design record, lane RESUME-V2 round 3 (user: "push deeper; we don't care what is under the hood; requirements: speed, beat everyone on speed / CPU / memory, client blazing fast with very low traffic"). No code.
- Method: for each axis, find the physical floor (what the hardware and the browser must do no matter what), measure how far today's Rivet and the best competitor sit from it, and design to the floor instead of to the competitor. Rounds 1–2 (`2026-10-18-beyond-resume-hydration.md`, `../specs/2026-10-18-structural-resume-design.md`) answered the rendering-model question; this round answers the *transport* and *runtime* questions, which turn out to be larger.
- Two findings drive everything below:
  1. **Rendering is not the dominant server cost.** The CPU breakdown at 1000 rows c1 (`../../benchmarks/2026-10-06-fair-comparison.notes.md`) attributes ~57 % of rivet-compiled's CPU/page to transport (Node HTTP core, the data client, the GC of decoded DTOs, kernel); the native Rust spike (`../../benchmarks/2026-10-06-rust-ceiling-spike.md`) measured the same from the other side: a byte-identical native server at **0.331 vs 1.083 ms CPU/page (3.27×) and 7 vs 183 MiB**, and concluded "even a perfect native renderer only removes ~40 % of Node's per-page CPU". The spike was dropped because a native *renderer inside Node* is worth ~1.15×. The conclusion inverts once the host itself is allowed to change.
  2. **Nobody's benchmark counts compression, and compression is the largest per-request cost in production.** ssr-bench and editorial-bench run identity encoding. A real origin or CDN brotli-compresses every response (q4–q5 ≈ 50–150 MB/s): an 88 KB page costs 0.6–1.8 ms CPU, i.e. more than Rivet's entire render (0.46 ms). Every framework pays it, nobody measures it, and it is almost entirely spent re-compressing bytes that are identical on every request (the template).

## 1. Floors

| Axis | Physical floor | Today (best lane, 1000 rows c1 unless noted) | Best competitor | Gap to floor |
| --- | --- | --- | --- | --- |
| Server CPU / page (identity encoding) | copy static bytes + format data + syscalls; proxy: native Rust full page 0.331 ms (with gRPC data fetch), static file 0.09 ms | Rivet static 0.46 (fair run) / 1.08 (spike run); Rivet resume 3.04 | Razor 1.64, Solid static 1.34, Solid hydratable 1.74 | 3× (static), 9× (resume); transport ≈ 57 % of it |
| Server CPU / page (compressed, as deployed) | ≈ identity floor + compressing only the data bytes (≈ 0 for a precompressed template) | identity + brotli of the whole page per request (not measured; est. +0.6–1.8 ms) | same for everyone | the largest unexploited term; no framework attacks it |
| Server memory | per-connection buffers + the runtime baseline; native: 6–9 MiB | 88 (static) / 166 (resume) MiB | Solid 100–142, Razor 122 | 10–20× |
| Bytes on the wire, first visit | brotli of the page (≈ 2.3× ratio on editorial HTML) | same | same | at the floor already |
| Bytes on the wire, later pages / navigations | the **data delta** against what the browser already holds (dictionary transport, RFC 9842; Google Search: −23 % HTML with a generic dictionary, more with an exact one) | full page brotli every time, or an SPA's JSON + a hydrated runtime | same | 2–5× on content pages, more on app pages |
| Client bytes before first input | 0 JS | 0 on static pages; 15.6 KB br fetched on router pages; 150–180 KB gzip on widget frames | Astro 0; Solid stable 8.3 KB (resume-bench) | at the floor on static pages, far on app pages |
| Client first interaction | the handler + the edits it implies (vanilla) | runtime + symbol chunks: 4 requests / 19.5 KB br for a counter click | Qwik: loader + core on first event; hydrated frameworks: 0 extra (paid earlier) | derived client (round 2) reaches it |
| Client first paint | the HTML parser on streamed bytes; 0 JS on the critical path | at the floor on static pages; loader inline 1.9 KB, state script on resumable pages | Astro at the floor | loader ≤ 1 KB, state → values (round 1) |
| Navigation | a prerendered next document (speculation rules): p75 LCP 320 vs 1,800 ms on the same sites | client router + `_data.json` + chunk fetch; 41.8 ms to paint on resume-bench | Qwik 89.7, Solid 192 ms | prerender beats all three by construction |
| Client memory / CPU after interaction | the browser DOM; no shadow graph | fine-grained graph for touched sites only | React / Vue: vDOM; Solid / Svelte: graph for the page | derived layer: none; adopted: graph for the widget |

Reading the table: on identity-encoded render CPU Rivet already leads; the floor is **3× lower** and it is in the host, not the templates. On every other axis the floor is reached by moving fewer bytes and running less code, which the rendering model alone cannot do.

## 2. The floor-first stack

Seven pieces. F1–F3 are the ones no competitor has; F4 is the big bet; F5–F7 are stances and plumbing.

### F1. Op-stream rendering (the render produces instructions, not strings)

- Today the compiled server target builds strings and writes them through `SlabWriter` (fused escape + encode, pooled slabs); the list plan interpreter `En` and the per-row `writeBytes` / `writeInteger` calls are 15–19 % of V8 busy time; the row tape is 20 % of allocations.
- Instead: the build emits, per route, a **segment table** (every static byte run of every template, pre-encoded; also the unit of F2 and F3) and the render emits an **op stream** into a shared `Int32Array` / byte buffer: `SEG id`, `TEXT off len` (escaped on the way in by the existing SIMD escaper), `INT value`, `ATTR …`, `ROWS plan count` (the wasm row emitter already works this way for uniform rows). Components stay JS; what leaves JS is the string work.
- The **writer** executes the stream: wasm now (the row emitter is the prototype), a native addon (N-API) next, the native host in F4 last. Render-side allocation drops to the op buffer; GC share (6–10 %) and `writeBytes` dispatch (19 %) go with it.
- The same segment table is the client's template source for the rendered layer (round 2) — one representation of markup for server, edge and browser.

### F2. Spliced compression (never compress the template per request) — **withdrawn by X1 (§8); replaced by F2′ below**

- Precompress each static segment once at build time as a **spliceable compressed block** against the route dictionary (F3): a block that references only itself and the dictionary, never earlier page bytes. Per response the writer emits one compressed frame = `[precompressed static blocks] + [small compressed or raw blocks for the dynamic data]`. CPU per request for compression ≈ compressing the data only; the template costs a memcpy.
- Candidates: zstd (raw / RLE / compressed blocks inside one frame; browsers accept `Content-Encoding: zstd` and dictionary `dcz`), brotli (meta-blocks; uncompressed meta-blocks are spliceable, compressed ones need window discipline). Spike X1 settles which decoders tolerate which splices (Chrome, Firefox, Safari; CDN passthrough).
- Fallback where splicing is refused: per-route dictionary + zstd level 1 on the whole page (≈ 500 MB/s with a dictionary that already holds the template → an 88 KB page ≈ 0.15 ms, ≈ 10× cheaper than brotli q5 and smaller output).
- This is where "beat everyone" is largest: every competitor spends 0.6–1.8 ms per page here or hands it to a CDN that spends it for them. The fair comparison gains an **encoded** profile (`--encoding br|zstd|dcz`) so the claim is measured, not inferred.

### F2′. Origin encoding: zstd by default, template-informed sequences in the native writer

- X1 (§8) measured that whole-page zstd −1 costs 0.18–0.25× brotli q5 at +5–10 % bytes, decodes in Chromium, and is cheaper than any JS-level splice of precompressed parts. Rule: the origin encodes `zstd` (−1 for large data-dense pages, −3 for content pages) when the client accepts it, brotli q4 otherwise; immutable assets stay precompressed brotli q11. Every ssr-bench / editorial-bench number gains an encoded column (R-A).
- Compression is still the largest per-page CPU term for big pages (1000 rows: zstd −1 1.3 ms vs 0.46 ms render), and it is the same for every framework that chooses the same codec. The one way below it is to stop *searching* for matches: the compiler already knows them. **Template-informed sequences**: the segment table is the dictionary, the op stream *is* the sequence list (each `SEG` = a match into the dictionary, each hole = a literal run), and the writer calls `ZSTD_compressSequences()` — entropy coding of the holes' literals plus sequence encoding, no match finder. Native-only (zstd C API; Node's binding has no sequence interface) → part of the native writer / host (F4). Bound to measure (X2′): compression CPU ≈ literals only, i.e. ≈ 10–15 % of a page's bytes on the table shape, ≈ 25 % on the article → an estimated 3–6× over zstd −1 at the same or better density.

### F3. Dictionary transport (the browser already has the template)

- Per route (or route group): one dictionary = segment table + inline loader + the route's derived program (round 2) + the adopted widgets' chunk prefix. First visit: the page as usual plus `Use-As-Dictionary` (match pattern = the route's URL space + its chunks). Every later page, navigation, live-page patch and chunk is delivered as `dcz` / `dcb` against it: **the wire carries the data delta**. Deploys ship code as deltas against the previous dictionary.
- Consequences: inline the derived program and the loader in every page (0 requests before input, 0 waterfall on first click) — their bytes are in the dictionary, so they cost ≈ 0 on the wire; prerendered next pages (F6) cost ≈ their data; widget chunks cost their delta.
- Browsers without dictionary transport (Safari today) get F2's spliced brotli; the design degrades to "normal good", never to "worse than today".
- Operational: `Available-Dictionary` / `Accept-Encoding` vary on the cache key (Cloudflare passthrough is in beta; a self-hosted node adapter does it natively); dictionary size bounded per route (segments + program, tens of KB); same-origin.

### F4. Native host (the 3×)

- The spike measured it: a Rust host (hyper, h2, native data clients) rendering byte-identical pages is 3.27× Node's CPU/page and 20× its memory, and the JSON boundary is what made "native renderer inside Node" worthless. **The op stream is the boundary that does not cost**: app code (loaders, components, actions) runs in embedded JS isolates inside the native host and writes ops into shared memory; the host owns HTTP/1.1 + h2 + h3, TLS, data connections, compression (F2), dictionaries (F3), route cache, streaming and backpressure.
- Isolate choice is a spike question: V8 via `deno_core`-style embedding keeps JS performance and most of the ecosystem (the router already runs on Deno at Node parity, and the router lane 30 % faster than Node); a smaller engine only for loaders is the lean alternative. Node compatibility of loaders (DB drivers, SDKs) is the real risk and the real question of X4.
- Steps that do not require leaving Node, each measured: (a) uWebSockets.js adapter (pilot 1.08–1.31×, exists) + (b) N-API op-stream writer + (c) F2 in the writer. If (a)+(b)+(c) reach ≥ 2× on the fair comparison, the native host waits; if not, it goes.
- Targets at 1000 rows c1 (fair-run scale): CPU/page 0.46 → ≤ 0.2 ms identity, ≤ 0.25 ms encoded (vs Razor 1.64 + its compression); peak RSS 88 → ≤ 20 MiB; TTFB / p50 follow CPU; 5000-row and c10 / c100 scale the same way (spike: 2.9–3.3× at every c).

### F5. Edge expansion (origin sends data, the edge sends pages)

- The segment table + dictionaries live on the edge (Workers / a Rust edge binary); the origin answers with the **op stream** (≈ data bytes). The edge expands, splices (F2) and serves `dcz` (F3). Origin CPU ≈ loaders + op emission; origin egress ≈ data; the page is assembled where the user is. ESI's idea with a compiled, typed instruction set instead of includes. Optional; the same op stream serves F1 and F5.

### F6. Client: derived client + inline program + prerender

- Rendering model: round 2 (native / derived / adopted / rendered layers, values-only wire). With F3 the derived program and loader are **inline**: a page is one request and interactive at first paint; the only external JS is adopted widgets' chunks, fetched ahead at idle, delta-compressed.
- Navigation: MPA-first with speculation rules (`moderate` eagerness on hover / viewport; conservative on Save-Data), cross-document view transitions, bfcache; prerendered pages are `dcz` documents ≈ their data. The client router is opt-in for apps whose state must survive navigation; when it is on, navigations fetch `dcz` HTML fragments or the op stream (the rendered layer can execute an op stream against the segment table: the same bytes, no `_data.json` sidecar).
- Actions: optimistic derived edit, then a live-page patch (`dcz`, ≈ the delta).

### F7. Memory and tails

- Native host: bounded per-connection buffers, no per-request object graphs (op buffer reused), no DTO GC (data decoded straight into the op stream's text region where possible). Node path meanwhile: the op buffer replaces the tape and the per-row calls; `--max-semi-space-size` stays tuned; the memory-reducer workaround stays.
- Tails (p99): no GC pauses on the native path; on Node, fewer allocations → fewer scavenges; `early` uncork stays.

## 3. Expected position vs the field (to be measured; bars in §5)

| Metric (1000 rows c1 unless noted) | Rivet today | Floor-first target | Best competitor |
| --- | --- | --- | --- |
| CPU / page, identity | 0.46 static / 3.04 resumable | ≤ 0.2 both (same wire, same host) | Solid static 1.34, Razor 1.64, Solid hydratable 1.74 |
| CPU / page, encoded | 0.46 + 7.4 (br q5, measured X1) | ≤ 0.2 + 1.3 (zstd −1, measured) now; ≤ 0.2 + ~0.3 with template-informed sequences (F2′, bound) | competitor render + 7.4 (brotli q5 default) or + 1.3 if they switch codec |
| Peak RSS | 88 / 166 MiB | ≤ 20 MiB | Solid 100, Razor 122 |
| Wire bytes, 2nd page of a session | full brotli page | ≈ data delta (`dcz`) | full brotli page (every MPA), JSON + runtime (SPAs) |
| JS before first input | 0 static; 15.6 KB router; 150–180 KB widgets | 0 external (inline program ≈ 0 B on the wire after the first page); widgets' chunks at idle, delta-compressed | Astro 0; others ≥ runtime |
| First click, cold, Fast 3G | 1.43 s (nothing fetched) | first paint = interactive (inline program) | hydrated islands 16–57 ms (paid at load) |
| Navigation to paint | 41.8 ms (client router) | ≈ 0 visible (prerendered) / `dcz` document otherwise | Qwik 89.7, Solid 192 |
| Server runtime bytes shipped per deploy | full chunks | deltas | full chunks |

Where this does not win: a site with no repeat visits and no navigation (one page, one visit) gains only F1 / F2 / F4; and a native host is a new runtime to maintain. Where it wins by construction: anything with sessions (every app), and every deployment that compresses.

## 4. What this means for the rendering-model work (rounds 1–2)

Unchanged: values-only wire format, four layers, derived slices, adopted boundaries, MPA-first. Refined: the **segment table** is the one markup representation for server (F1), edge (F5) and browser rendered layer (F6), and the **dictionary** is where the loader, the derived program and the segments live on the client — so "inline everything small" becomes free and the chunk question (≤ 3 requests) mostly dissolves into "0 external requests for application pages".

## 5. Spikes and bars

| Spike | What | Bar |
| --- | --- | --- |
| **X1 splice tolerance** — DONE 2026-10-18 (§8) | as below; harness `apps/ssr-bench/spikes/splice/` | decode: yes (Chromium 141); CPU bar: not met by splicing, met by zstd −1 (0.18×) → F2 withdrawn, F2′ adopted |
| **X2′ template-informed sequences** (2 days, native) | a C or Rust program: segment table + op stream → `ZSTD_compressSequences` vs `ZSTD_compress` −1 / −3 on the X1 shapes; bytes + µs | ≥ 3× over zstd −1 at ≤ +5 % bytes; decodes as plain `zstd` |
| **X2 op-stream writer in Node** (1 week) | segment table + op buffer + N-API (or wasm) writer on the ssr-bench static page and `/resume`; with uWS | ≥ 1.5× CPU/page vs HEAD static at 1000 rows c1 / c10; allocation −50 % |
| **X3 dictionary transport end-to-end** (2 days) | per-route dictionary on editorial-bench and the docs site; bytes for 2nd page, navigation, live patch, chunk delta after a deploy | 2nd-page bytes ≤ 40 % of brotli; chunk delta ≤ 20 % |
| **X4 native host prototype** (3 weeks, only if X2 < 2×) | Rust host + embedded isolate running the real router + loaders of ssr-bench `router-app`; op stream over shared memory; fair comparison all cases | ≥ 2.5× CPU/page vs HEAD, RSS ≤ 25 MiB, loaders unchanged |
| **S2** (round 2, unchanged) | derived slices on resume-bench | as stated there |
| **Harness** | `--encoding` profile for ssr-bench / editorial-bench; a "session" scenario (3 pages, 1 navigation, 1 action) measuring wire bytes | reports exist before any claim |

X1 and X3 are cheap and independent of everything else; X2 decides between "Node stays" and X4. S2 decides the rendering model. All five fit in the repo's existing harnesses.

## 6. Rulings (user) — **taken 2026-10-18: R-A yes, R-B yes (E1–E3 in the plan's server track), R-C native host subsumed by the backend-agnostic direction (not built), R-D yes after dictionaries, R-E not now** (`../plans/2026-10-18-derived-client.md`)

- **R-A.** Measure encoded, not identity: the fair comparison gains an encoded profile and a session scenario; the "beat everyone" claim is made on those.
- **R-B.** Pursue F1–F3 now (compiler segment table, op-stream writer, spliced compression, dictionary transport). They are host-independent and attack the largest unmeasured cost.
- **R-C.** Native host (F4) is a go only on X2's result (< 2× in Node) and X4's bar; until then the Node path with uWS + native writer is the product.
- **R-D.** Inline the derived program + loader by default once F3 exists (0 external JS on application pages); external chunks only for adopted widgets.
- **R-E.** MPA-first with speculation rules as the starter default; client router opt-in (restated from round 2).

## 7. Risks, honestly

- Splicing may be rejected by some decoder (X1 answers in days); fallback is dictionary + zstd -1, still a large win.
- Dictionary transport coverage (Safari) and CDN support (beta): the design never regresses without it, but the "≈ data bytes" claim holds only where it is supported — report both.
- A native host is a runtime: packaging, Node API compatibility for loaders, debugging, platform adapters (Vercel / Netlify / Workers keep the Node path; the native host is for self-hosted and the edge binary). Scope it as a product line, not a flag.
- Op-stream compile shape: components still run in JS; the win is bounded by how much of the per-page time is string work + GC (today ~30–40 % of the Rivet-owned share) unless the host changes (F4). X2's bar is set accordingly.
- Measurement discipline: every number above marked "est." is a bound from existing reports, not a measurement; the harness changes come first.


## 8. X1 result (2026-10-18, this container: Node 24.14.1 zlib zstd / brotli, Chromium 141.0.7390.37, 1 vCPU cloud host, no bench lock — ratios only)

Harness: `apps/ssr-bench/spikes/splice/splice.ts bench` (encode CPU per page, bytes, Node frame-by-frame decode) and `browser.ts` (Chromium fetch of every shape × scheme, decoded text compared with the identity response). Shapes: the ssr-bench fixture table at 100 / 1000 rows (seeded pseudo-random values; a first run with repetitive synthetic strings gave 10× better ratios for every codec and was discarded) and an article page (≈ 25 KB static chrome + 8 KB dynamic body). Schemes: whole-page brotli q4 / q5 / q6, whole-page zstd −1 / −3, full splice (every static segment a precompressed zstd −19 frame, every hole a hand-built single-raw-block frame), hybrid (static frames; the hole-dense region zstd −1 / −3 per request as one frame).

| shape | scheme | bytes | ratio | encode µs / page | vs br q5 |
| --- | --- | ---: | ---: | ---: | ---: |
| table 1000 (757 KB) | br q5 | 69,156 | 0.091 | 7,422 | 1.00× |
| table 1000 | br q4 | 79,652 | 0.105 | 3,989 | 0.54× |
| table 1000 | zstd −1 | 76,370 | 0.101 | 1,317 | 0.18× |
| table 1000 | zstd −3 | 72,591 | 0.096 | 1,799 | 0.24× |
| table 1000 | full splice | 998,343 | 1.318 | 8,688 | 1.17× |
| table 1000 | hybrid, dense zstd −1 | 76,398 | 0.101 | 6,364 | 0.86× |
| table 100 (76 KB) | br q5 / zstd −1 / hybrid −1 | 7,534 / 8,830 / 8,942 | 0.099 / 0.116 / 0.117 | 787 / 199 / 496 | 1.00× / 0.25× / 0.63× |
| article (33 KB) | br q5 / zstd −1 / zstd −3 | 5,715 / 7,150 / 6,536 | 0.171 / 0.214 / 0.196 | 580 / 117 / 313 | 1.00× / 0.20× / 0.54× |
| article | full splice / hybrid −1 / hybrid −3 | 19,082 / 7,187 / 6,931 | 0.572 / 0.216 / 0.208 | 402 / 397 / 367 | 0.69× / 0.68× / 0.63× |

Decode: Chromium 141 decoded all 24 shape × scheme bodies byte-exactly, including multi-frame zstd with hand-built raw frames (Node's own `zstdDecompressSync` / streaming decoder stop after the first frame — a Node limitation, not a format one). Firefox / WebKit are not installed in this container: untested (WebKit has no `zstd` content-encoding as far as known → brotli path).

Findings:
1. **Splicing loses.** A raw frame costs 9–16 bytes per hole: +32 % over *identity* on the table, and on the article the uncompressed body dominates (0.57×). The hybrid (compress the dense region per request) lands within 1 % of whole-page zstd at the same level — the static chrome compresses to nearly nothing either way — and costs more CPU in JS than compressing the whole page, because zstd −1 runs at ≈ 570 MB/s while assembling thousands of parts in JS does not. Precompressed frames give nothing a dictionary does not give better (F3). F2 withdrawn.
2. **The codec is the lever.** brotli q5 (the usual origin / CDN default) costs 7.4 ms at 1000 rows — 16× Rivet's render — and 0.6 ms on a 33 KB article. zstd −1 costs 0.18–0.25× of that at +5–17 % bytes (−3: 0.24–0.54× at +5–14 %). For the editorial / table shapes brotli q4 is the brotli sweet spot (0.54×, +15 % bytes) but still 3× zstd −1. Adopted as F2′: origin zstd by default; measure encoded.
3. **Compression stays the largest per-page cost on large pages even at zstd −1** (1.3 ms vs 0.46 ms render at 1000 rows), and that cost is codec-bound, identical for every framework on the same codec. Beating it needs the compiler's knowledge: the segment table as dictionary and the op stream as a precomputed sequence list (`ZSTD_compressSequences`, no match finder) — F2′ second half, spike X2′, native writer only.
4. Methodology: assembling the identity page from 33 k small parts in JS cost 4.7 ms here (10× the real `SlabWriter` path); every scheme's cost above excludes it. Numbers are from a loaded 1-vCPU cloud container and are ratios only; the bench host re-run is still owed for absolute values and for Firefox.
