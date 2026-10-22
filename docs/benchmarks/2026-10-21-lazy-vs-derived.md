# Lazy rows vs derived model — client cost on the story harness (LAZY-VS-DERIVED / LVD-2, 2026-10-22)

Hand-written. Decision input for the held serialized flip (`resume.lazyRows` + `resume.domData`, `04-flip.patch`) under the user's rule "derived ≥ lazyRows on the collection pages → no serialized flip, all effort to M6; otherwise flip lazyRows + domData together". Base `831b5d5ee` (LAZY-BLOCKERS landed). DERIVED-C4 (domData on derived) has not landed, so there is no `derived+domData` build. Lane LAZY-VS-DERIVED wrote the harness and a preliminary n = 1 table, but the host slept during its run. Lane LVD-2 reran everything at n = 7 (2026-10-22 09:03–10:07, host on battery and awake).

## Builds

`apps/ssr-bench/spikes/lazy-cost/stories` built four ways (`stories.ts --build [--dom-data] --dist <d>`):

- `default` (`RIVET_LAZY_BUILD=0`): serialized, recorded rows.
- `lazy`: lazyRows.
- `both`: lazyRows + domData.
- `derived` (`RIVET_RESUME_MODEL=derived`, i.e. `resume: { model: "derived" }`, knob in the story `vite.config.ts`).

Every route builds, renders 200 and resumes under derived. There were no page errors, and every click reached its DOM effect. There were no `ERR_NETWORK_IO_SUSPENDED` errors and no sleep during the run.

## First click → paint (ms, median of 7)

Paint ms = pointerdown → the task after the rAF after the DOM change. Builds are interleaved, with a rotated order per trial. A sample is gated on the 1-min load ≤ 8 (`--max-load 8 --max-wait 30`, rerun ≤ 3×). 6 of 1,232 samples ended above 8 (max 24.4, a Docker VM + .NET spike on the host) and are dropped from the medians. `/dom-data-200` slow4 default / lazy are therefore n = 6. Samples per cell ran at load 1.7–8.0. Ranges per cell are in the `.json`.

| route | scenario | default | lazy | both | derived | derived / both |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `/list-data-1000` | row fast1 | 31.6 | 8.9 | **8.8** | 14.2 | 1.61× |
| | row fast4 | 104.1 | 29.7 | **29.1** | 46.7 | 1.60× |
| | row slow4 | 103.9 | 30.3 | **29.5** | 50.2 | 1.70× |
| | ctl fast1 / fast4 | 8.4 / 29.3 | 13.5 / 31.9 | **5.9 / 29.1** | 29.3 / 57.8 | 4.97× / 1.99× |
| | move-50 fast1 / fast4 | 14.7 / 65.7 | **14.7 / 51.8** | 15.2 / 57.9 | 25.0 / 70.6 | 1.64× / 1.22× |
| `/dom-data-1000` | row fast1 | 50.4 | **31.9** | 32.5 | 48.8 | 1.50× |
| | row fast4 | 136.3 | 57.8 | **55.4** | 80.3 | 1.45× |
| | row slow4 | 140.7 | **56.5** | 56.8 | 87.5 | 1.54× |
| | ctl fast1 / fast4 | **11.1** / 26.4 | 11.4 / **25.1** | 12.2 / 29.7 | 28.5 / 62.0 | 2.34× / 2.09× |
| `/dom-data-200` | row fast1 | 36.2 | **31.6** | **31.6** | 42.2 | 1.34× |
| | row fast4 | 61.6 | **50.4** | 52.6 | 67.6 | 1.29× |
| | row slow4 | 70.1 | **48.1** | 52.8 | 70.9 | 1.34× |
| | ctl fast1 / fast4 | 14.8 / 30.5 | 15.3 / **26.8** | **11.7** / 30.1 | 16.5 / 48.2 | 1.41× / 1.60× |
| `/resume-1000` | row fast1 | 27.6 | 23.9 | **18.6** | 28.2 | 1.52× |
| | row fast4 | 27.5 | **19.7** | 22.6 | 30.9 | 1.37× |
| | row slow4 | 26.5 | **24.6** | 25.4 | 34.4 | 1.35× |
| | ctl fast1 / fast4 | 22.7 / 30.5 | 28.9 / 26.5 | 30.4 / **22.8** | **21.7** / 33.6 | 0.71× / 1.47× |
| `/virtualized-collections` | row fast1 | **31.8** | 33.7 | 33.1 | 72.4 | 2.19× |
| | row fast4 | 55.1 | 59.0 | **53.7** | 205.2 | 3.82× |
| | row slow4 | 55.4 | 57.8 | **53.1** | 226.2 | 4.26× |
| | ctl fast1 / fast4 | 11.0 / **21.3** | **5.7** / 28.8 | 13.9 / 25.1 | 58.6 / 188.2 | 4.22× / 7.50× |
| `/table` | row fast1 | 40.5 | **35.3** | 36.4 | 50.3 | 1.38× |
| | row fast4 | 52.0 | **51.2** | 51.8 | 62.2 | 1.20× |
| | row slow4 | **47.4** | 48.7 | 48.7 | 71.9 | 1.48× |
| | ctl fast1 / fast4 | **9.9** / 26.0 | 14.5 / 28.8 | 12.6 / **21.8** | 18.5 / 61.5 | 1.47× / 2.82× |
| `/grid-list` | row fast1 | 12.7 | 6.0 | **5.8** | 12.9 | 2.22× |
| | row fast4 | 27.3 | 19.4 | **16.9** | 43.5 | 2.57× |
| | row slow4 | 28.5 | 18.2 | **17.3** | 36.9 | 2.13× |
| | ctl fast1 / fast4 | 13.6 / 25.4 | 11.9 / 26.1 | **10.3 / 23.2** | 17.4 / 48.0 | 1.69× / 2.07× |

- Derived loses the first click on all 7 routes at fast4 and slow4: 1.2–1.7× on the plain / dom-data lists, 2.1–2.6× on `/grid-list`, 3.8–4.3× on `/virtualized-collections`.
- On the collection pages, the click without a row (ctl) is 2–7.5× slower under derived than under `both`. The first input pays for collection-host adopt.
- lazyRows (with or without domData) is 2.6–3.5× faster than `default` on `/list-data-1000` and `/dom-data-1000`. It is at parity on `/virtualized-collections`, `/table` and `/resume-1000`.

## Idle load (fast1, 3 s settle) and bytes

| route | JS before input KB / files, row fast4 (default · lazy · both · derived) | script before input ms, fast4 | idle heap MB after GC | document br B | state / tail br B |
| --- | --- | --- | --- | --- | --- |
| `/list-data-1000` | 101.7/11 · 107.4/13 · 108.0/13 · 86.8/33 | 24.9 · 10.7 · 16.7 · 4.9 | 3.65 · 2.44 · 2.47 · 1.37 | 44013 · 15851 · 13928 · **7442** | 35404 · 8524 · 6577 · **2346** |
| `/dom-data-1000` | 96.4/10 · 102.1/12 · 102.7/12 · 85.9/32 | 25.8 · 12.1 · 14.3 · 5.2 | 3.50 · 2.25 · 2.27 · 1.35 | 37066 · 14216 · 12873 · **6094** | 28759 · 6377 · 4912 · **360** |
| `/dom-data-200` | 96.4/10 · 102.1/12 · 102.7/12 · 85.9/32 | 14.9 · 10.8 · 10.6 · 5.4 | 2.25 · 1.99 · 2.01 · 1.35 | 11773 · 6743 · 6427 · **3304** | 7705 · 2658 · 2376 · **358** |
| `/resume-1000` | 73.2/8 · 43.4/8 · 44.0/8 · 39.8/8 | 15.7 · 13.2 · 8.3 · 3.4 | 2.23 · 1.55 · 1.78 · 0.97 | 30071 · 26540 · **18596** · 25139 | 10332 · 8842 · **651** · 8500 |
| `/virtualized-collections` | 210.7/26 · 216.5/28 · 217.1/28 · 191.4/63 | 45.5 · 90.9 · 87.2 · 8.3 | 8.17 · 8.65 · 8.65 · 2.28 | 30953 · 20681 · 20597 · **9207** | 24845 · 14675 · 14744 · **4441** |
| `/table` | 138.6/15 · 144.3/17 · 144.9/17 · 125.1/45 | 35.3 · 33.0 · 33.0 · 6.4 | 3.23 · 3.36 · 3.37 · 1.68 | 14415 · 8029 · 8049 · **3910** | 10376 · 4048 · 4051 · **913** |
| `/grid-list` | 118.8/12 · 124.5/14 · 125.1/14 · 116.6/48 | 30.0 · 30.7 · 30.4 · 6.3 | 2.46 · 2.45 · 2.46 · 1.61 | 9751 · 7371 · 7367 · **3262** | 6142 · 3340 · 3340 · **592** |

- Derived "state" = the `rivet/boundaries` tail(s).
- Derived idle heap and script are measured before the first input, while derived has not adopted anything yet. They are not comparable with the serialized builds' post-resume heap. The first-click table charges the cost that derived defers.
- Derived document br is 0.44–0.53× `both` on the six cdk pages. On `/resume-1000` it is 1.35×: no domData on derived, so row values repeat.
- Derived fetches 2.4–3.4× more JS files before input (per-module boundary chunks) but 4–25 KB fewer bytes. slow4 timings include that cost.

## Server CPU per request (in-process, `cpu.ts`, one worker per build, 5 rounds × 1,500 renders after 50 warm, median)

| page | default | lazy | both | derived | derived / both | load |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `/list-data-1000` | 47.07 | 10.23 | 10.12 | **6.68** | 0.66× | 2.8–5.6 |
| `/resume-1000` (run 1) | 2.90 | 2.68 | 2.65 | **1.92** | 0.73× | 5.0–15.7 |
| `/resume-1000` (rerun) | 2.72 | 2.74 | 2.76 | **1.94** | 0.70× | 5.4–9.6 |

- Unit: ms CPU (user + system) per request. Wall ms per request is in the `.json`.
- HTML bytes for `/list-data-1000`: 730 / 301 / 268 / 286 KB.
- The first `/resume-1000` round ran during a host spike. The rerun at lower load reproduces it within 7 %.

## `/resume-1000`: the preliminary fast1 outlier does not reproduce

The preliminary table (n = 1) had default at 6.9 ms vs lazy / both at 21–23 ms. At n = 7 the fast1 row click is 27.6 / 23.9 / 18.6 / 28.2 ms, and the samples spread 8–34 ms in every build.

- **Why fast1 paint is noisy:** at fast1 the click's script is ~5–8 ms. Paint ms waits for the next rAF, so it adds 0–16.7 ms of frame phase, and the distribution is bimodal. The n = 1 "6.9" was a sample that caught an early frame.
- **Profile** (CDP CPU profile, 50 µs sampling, 7 clicks per build), DOM-change ms (pointerdown → mutation, median):

  | condition | default | lazy | both | derived |
  | --- | ---: | ---: | ---: | ---: |
  | fast1 | 7.7 | 5.8 | 5.6 | 7.4 |
  | fast4 | 34.0 | 24.9 | 25.4 | 33.1 |

  - No script is fetched after the click: the lazy chunk was already preloaded.
  - lazy / both spend ~3.5 ms (fast1) / ~15 ms (fast4) inclusive in `dom-resume-lazy` (writers `V` / `H` / `M`). default spends ~5.4 / 22.7 ms in `resume-entry` (`qe`).
- **Conclusion:** there is no lazy regression and no suspect. The LAZY-BLOCKERS 4× parity holds: lazy at or below default at fast4 (19.7 vs 27.5).

## Decision

| route | best first click (fast4 / slow4) | derived / both, row fast4 / slow4 | derived / both, document br |
| --- | --- | --- | --- |
| `/list-data-1000` | both / both | 1.60× / 1.70× | 0.53× |
| `/dom-data-1000` | both / lazy | 1.45× / 1.54× | 0.47× |
| `/dom-data-200` | lazy / lazy | 1.29× / 1.34× | 0.51× |
| `/resume-1000` | lazy / lazy | 1.37× / 1.35× | 1.35× |
| `/virtualized-collections` | both / both | 3.82× / 4.26× | 0.45× |
| `/table` | lazy / default | 1.20× / 1.48× | 0.49× |
| `/grid-list` | both / both | 2.57× / 2.13× | 0.44× |

**Under the user's rule, the data supports "flip lazyRows + domData together".** Derived is not ≥ lazyRows on any collection page. Its first click at 4× CPU is 1.2–4.3× slower than `both`:

- 1.6× on `/list-data-1000`
- 2.6× on `/grid-list`
- 3.8× on `/virtualized-collections`

The row-less click is 2–7.5× slower, so the cost is collection-host adopt at the first input, not the row itself. Derived wins on everything before the first input: document bytes 0.44–0.53× `both` on the cdk pages, server CPU 0.66–0.73× `both`, script before input 3.4–8.3 ms at 4×. `both` beats `default` 3.5× on the first click on `/list-data-1000` and 2.5× on `/dom-data-1000`, and it is never worse than `default` on a row click at fast4 / slow4 beyond noise (≤ 1.3 ms).

The DERIVED gaps behind each derived loss:

- **Collection pages** (`/virtualized-collections`, `/grid-list`, `/table`, `/list-data-1000`, ctl clicks): collection-host adopt is O(collection), not O(touched) (DERIVED-C3 "What M6 still needs"). The fix is DERIVED-C4 item 1: server dependency facts + deferred adopt. It is built but not green and not measured. An informal unminified 1× read was ~8.5 ms on `/virtualized-collections`.
- **`/resume-1000` and the dom-data pages**: no DOM-DATA on derived (C3 ruling 03, C4 item 2 not started), so repeated row values ship in the tail (8.5 KB vs 0.65 KB) and the document is 1.35× `both`.

The flip lands lazyRows + domData now. M6 still needs C4 items 1 + 2 measured on this harness before derived can replace serialized.

## Commands

```sh
export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH NODE_OPTIONS=--max-old-space-size=1536
H=apps/ssr-bench/spikes/lazy-cost
RIVET_LAZY_BUILD=0 nice -n 10 node $H/stories.ts --build --dist <d>/default --pages /list-data-1000 --rounds 1 --samples 1
nice -n 10 node $H/stories.ts --build --dist <d>/lazy --pages /list-data-1000 --rounds 1 --samples 1
nice -n 10 node $H/stories.ts --build --dom-data --dist <d>/both --pages /list-data-1000 --rounds 1 --samples 1
RIVET_RESUME_MODEL=derived nice -n 10 node $H/stories.ts --build --dist <d>/derived --pages /list-data-1000 --rounds 1 --samples 1
B=default=<d>/default,lazy=<d>/lazy,both=<d>/both,derived=<d>/derived
node $H/client.ts --builds $B --pages /list-data-1000,/dom-data-1000,/dom-data-200,/resume-1000,/virtualized-collections,/table,/grid-list \
  --loads 7 --conditions fast1,fast4,slow4 --scenarios row,ctl,move,idle --max-load 8 --max-wait 30 --json <out>.json > <out>.md
node $H/cpu.ts --builds $B --pages /list-data-1000,/resume-1000 --rounds 5 --samples 1500 --json <cpu>.json > <cpu>.md
```

Harness changes:

- `client.ts`:
  - sums derived `rivet/boundaries` tails into "state"
  - logs page / console errors
  - reruns a click sample (≤ 3×) that starts or ends above `--max-load`
- `cpu.ts` (new): one worker process per build, rounds interleaved, CPU per request.

The tables above drop the 6 samples that still ended above load 8 (`.json` `client.note`). The `/resume-1000` click profile is a lane-local script (CDP `Profiler`, 7 clicks per build). Its medians are in `.json` `resume1000ClickProfile`.

Host: macOS arm64 (on battery, awake), Node 26.5.1, Chromium 153.0.8010.12 (playwright headless shell).
