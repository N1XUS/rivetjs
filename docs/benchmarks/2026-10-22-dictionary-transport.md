# Compression Dictionary Transport (M5 E3) — 2026-10-22

Lane M5-E3, derived-client plan M5 (`docs/design/plans/2026-10-18-derived-client.md`). Host: macOS arm64, Node 26.5.1 (zstd `dictionary` also checked on 24.18.0 / 24.18.1), Playwright Chromium 153; host load avg 6–15 (other lanes running) — ratios only, no absolute claims. Raw rows: `2026-10-22-dictionary-transport.json`.

## What shipped

- RFC 9842 in the node adapter (`libs/router/adapters/dictionary.ts`, `node.ts`): `dcz` only (zstd + raw dictionary). `dcb` (brotli q4 + dictionary) measured ≈ br q4 (no gain) → not offered.
- ONE site dictionary, 128 KiB max: content-defined segments (24–512 B) shared by ≥ 2 sample pages, ≤ 12 evenly spaced pages per first path segment + their `_data.json`. Built by `prerenderBuild` / docs-kit build (`_rivet/dict/<id>.dict` + `.vite/rivet-dictionaries.json`), or at start from `serve({ dictionary: { samples } })`.
- Delivery: `Link: <…>; rel="compression-dictionary"` on HTML; dictionary file `public, max-age=31536000, immutable` + `Use-As-Dictionary: match="<base>/*"`; every compressible non-immutable answer under the prefix: `Vary: Accept-Encoding, Available-Dictionary`, `dcz` when `Available-Dictionary` matches and `dcz` q > 0. Static files: zstd 19 dcz copy in the memory cache; route-cache pages: dcz copy per dictionary id; rendered pages: zstd −3 one-shot / stream with dictionary.
- Chromium e2e (`libs/router/tests/dictionary-e2e.test.ts`): idle fetch after Link, then client navigation `_data.json` and next document both arrive `dcz` and render.

## Dictionary candidates (dcz −3 / br q4, mean per page; site = shipped)

Candidates: shell (common prefix/suffix), segments (per group), trained (`zstd --train`), site (shipped), chunks (route JS/CSS), previous (the page before, same group).

| site | group | HTML / page | br q4 | zstd −3 | site dcz −3 | vs br q4 | vs zstd | previous | encode µs (plain) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ui-docs | api | 68459 | 16655 | 17492 | 2452 | 15 % | 14 % | 7 % | 195 (102) |
| ui-docs | components | 212646 | 28906 | 30436 | 11371 | 39 % | 37 % | 26 % | 290 (220) |
| ui-docs | examples | 77436 | 18098 | 19088 | 3367 | 19 % | 18 % | 84 % | 207 (108) |
| ui-docs | showcase | 148727 | 26140 | 27406 | 10188 | 39 % | 37 % | 31 % | 269 (174) |
| ui-docs | start | 119657 | 23913 | 25119 | 7748 | 32 % | 31 % | 24 % | 277 (158) |
| editorial-1000 | articles | 7046 | 2505 | 2604 | 1900 | 76 % | 73 % | 70 % | 101 (22) |
| editorial-1000 | authors | 17729 | 3998 | 4071 | 2657 | 66 % | 65 % | 85 % | 123 (39) |
| editorial-1000 | page | 7650 | 2114 | 2235 | 1316 | 62 % | 59 % | 70 % | 92 (18) |
| editorial-1000 | tags | 17609 | 4177 | 4274 | 2071 | 50 % | 48 % | 75 % | 117 (40) |
| editorial-100 | articles | 7045 | 2501 | 2598 | 1883 | 75 % | 73 % | 70 % | 43 (21) |
| editorial-100 | authors / page / tags | 3683–7572 | 1190–2091 | 1283–2208 | 473–784 | 37–40 % | 35–37 % | 61–69 % | 28–36 (12–21) |

- Site dictionary: ui-docs 131070 B (24712 B on the wire, zstd 19), break-even 1.3–1.6 pages; editorial-1000 89221 B (17012), break-even 7.7–24 pages; editorial-100 26201 B (5824).
- shell ≈ 95–101 % (useless); chunks 71–110 % (worse than site everywhere); trained ≤ site on documents, 30× dictionary size cost on articles; per-group segments ≈ site at 128 KiB (one download instead of five).
- Data answers (`_data.json` 325–657 B): site dict 68–81 % of br q4 but +110 µs encode; most are below the adapter's 1 KiB compression floor anyway.
- 192 / 256 KiB dictionaries: no further gain on ui-docs (saturated).

## Previous document as dictionary — rejected

Best on docs (7–31 %), but Chromium stores a dictionary only while the response is fresh: `no-cache`, `no-store`, `max-age=0, must-revalidate`, `no-cache, max-age=3600` → not stored; `max-age=60`, `max-age=0, stale-while-revalidate=3600` → stored. HTML would need freshness (stale documents) for it → out.

## Chunk delta after a deploy — not shipped

main 2026-10-20 ui-docs build → this snapshot's build, 1367 changed chunks ≥ 1 KiB, old file of the same name as dictionary: br q11 2836617 B, dcz 19 1308905 B = 46 % (bar ≤ 20 %: missed). Would also need old assets kept and a name → previous-hash index. Open.

## Server (ssr-bench encoded harness, `--encoding all`, 200 req × 5 rounds, median; load 5.9–7.3)

| page | zstd wire | dcz wire | zstd CPU µs | dcz CPU µs | zstd TTFB µs | dcz TTFB µs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| table100 (74.6 KB) | 8794 | 8231 | 370 | 499 | 265 | 378 |
| table1000 (739.7 KB) | 76666 | 77509 | 2410 | 2562 | 1542 | 1584 |
| article (32.6 KB) | 6766 | 3484 | 248 | 289 | 210 | 264 |
| session (doc + 2 data + action) | 17647 | 13407 | 822 | 924 | 161 | 215 |

- Session dcz = 0.725× br q4 (zstd 0.954×), dictionary fetched once (9616 B wire). Samples = articles 3 + 4 (never measured pages); table rows share little → table1000 +1 %.
- TTFB delta +42–113 µs (bar ± 1 ms: met). CPU cost = Node loads the dictionary per call (no CDict reuse in `node:zlib`): ≈ +80 µs at 128 KiB / level 3.

## E3 gate

- "2nd page ≤ 40 % of brotli": met on ui-docs documents (15–39 %) and the small editorial-100 listings (37–40 %); not on articles (75 %) or synthetic ssr-bench pages — their own text dominates.
- "chunk delta ≤ 20 %": not met (46 %), not shipped.

## Platform support

- Node 24 / 26: `zlib.zstdCompressSync` / `createZstdCompress` `{ dictionary }` work (24.18.x, 26.5.1 checked; CI pin 24.14.1 not installed here).
- Cloudflare / Vercel / Netlify: assets-only hosting cannot vary on `Available-Dictionary`; platform packaging writes no dictionary; docs Workers build ships the file unused. Edge `CompressionStream` has no dictionary. Node adapter only.
- Browsers: Chromium ≥ 130 (HTTPS or localhost); Safari / Firefox fall back to zstd / br / gzip.
