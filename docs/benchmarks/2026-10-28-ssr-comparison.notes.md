## How this run was made

- Source: `main` at `2c51055a8` (after HYGIENE; before JS-DIET-2, which does not touch the server render path). Same matrix, settings and images policy as 2026-10-27 BENCH-REACT: 12 lanes, `--duration 10 --warmup 3 --repeats 3 --prewarm 10 --gc tuned`, integer pages at 100 / 1,000 / 5,000 rows (c1) and 100 / 1,000 rows (c10), plus `--grid` and `--strings` at 1,000 rows c1. 252 recorded trials, zero failed responses.
- Two earlier attempts the same evening stalled in the Docker image build (`load metadata` for `oven/bun` / `denoland/deno` never returned, `docker pull` hung too); both were stopped before any trial ran. This run started after Docker answered again.
- **Host load**: other agent lanes ran builds and tests during the run. 1-minute load average sampled at every trial boundary: 2.2–21.0, median 5.5 (2026-10-27: 4.1–59.1, median 8.3; 2026-10-23: 4–7). Per batch (min / median / max): c1-r100 6.8 / 10.0 / 21.0; c1-r1000 4.1 / 5.2 / 6.4; c1-r5000 3.6 / 4.6 / 6.1; c10-r100 3.4 / 5.6 / 7.4; c10-r1000 3.8 / 6.3 / 13.3; grid 4.4 / 6.0 / 7.5; strings 2.2 / 3.4 / 5.9. The 100-row c1 batch is the noisiest; its wide ranges (for example Rivet resumable 704–3,032 req/s) come from that.
- **Docker on macOS**: Docker Desktop runs a Linux ARM64 VM on an Apple M4 Pro; each frontend gets 1 CPU / 512 MiB inside it.
- **Stored competitors: not re-stored** (`apps/dom-bench/competitors.json` stays on 2026-10-23): the first batch ran at load up to 21.

## Against 2026-10-27

- Static (`rivet-compiled`): every metric except HTML bytes is now WIN against Razor, Solid 1 static and React static (2026-10-27: TIE on throughput, CPU and memory). HTML bytes stay TIE.
- Resumable (`rivet-resume`): CPU per page and complete p99 no longer lose (2026-10-27: one LOSE each against Solid 1 hydratable). HTML bytes improve from LOSE against React and Qwik 2 to WIN / TIE; they still lose against Solid 1 / 2 hydratable (up to ×1.12 at 100 rows).
- Remaining losses are peak memory (worst ×1.67 against Qwik 1 at 100 rows c10) and HTML bytes against Solid hydratable. Both are listed under "Rivet's remaining losses".
