# SSR peak memory at a matched request rate (2026-11-02)

Follow-up to `2026-10-29-ssr-rss.md`: the closed-loop 100-row case left rivet-resume behind qwik-stable on peak RSS (93 / 153 vs 87 / 118 MiB, c1 / c10) while serving ~27x more requests per second. Peak RSS of a closed loop scales with allocation rate, so this run offers every lane the same open-loop rate.

- Command: `node apps/ssr-bench/run-python.ts apps/ssr-bench/benchmark.py --skip-build --frameworks rivet-resume,rivet-router,qwik-stable --rows 100 --concurrency 1,10 --rate 200 --duration 15 --repeats 2`
- Base: main at bddfe46a3 (images built the same day); run `20261102T120711.974484Z-99a0b543`; 1 CPU / 512 MiB per frontend container, tuned GC profile on every Node lane.
- Host load 1m during the run: 6.6–10.5 (other work running): CPU numbers are noisy, peak memory less so.

| lane | c | peak RSS MiB (rep 1 / 2) | CPU ms / response (rep 1 / 2) |
| --- | ---: | --- | --- |
| rivet-resume | 1 | 70.7 / 71.5 | 1.06 / 1.29 |
| rivet-router | 1 | 67.0 / 68.0 | 0.99 / 1.00 |
| qwik-stable | 1 | 85.6 / 90.8 | 3.56 / 3.70 |
| rivet-resume | 10 | 72.2 / 72.9 | 1.25 / 1.20 |
| rivet-router | 10 | 68.5 / 69.0 | 1.10 / 1.03 |
| qwik-stable | 10 | 103.7 / 96.3 | 4.31 / 3.99 |

All lanes held 200.0 successes/s with 0 failures.

Verdict: at an equal rate rivet-resume uses 19–27 % less peak memory than qwik-stable (mean c1: 71 vs 88 MiB, c10: 73 vs 100 MiB) and 3.1–3.4x less CPU per response. The closed-loop deficit is the cost of serving 27x the traffic in the same container, not a per-request overhead. The closed-loop row stays in the scoreboard as measured; the rate-matched view is the like-for-like memory comparison.
