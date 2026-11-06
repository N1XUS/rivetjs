# SSR comparison 2026-11-06 (lane SSR2)

Fresh Docker run of `apps/ssr-bench` at `main` `297388c58` (after derived resume, FLAT / COFLAT flat runtimes, early-hint runtime sinks, SSR-STREAM segments), plus the SSR2 change (DOM-data "kept" proof from the row emitter) measured as an interleaved image A/B. Hand-written (not `fair-report.ts`): 8 lanes, so the verdict tables of 2026-10-28 are not regenerated; compare like-for-like classes as stated there (static: `rivet-compiled` vs Razor / Solid 1 static; resumable: `rivet-resume` vs Solid 1 hydratable lanes / Qwik 1).

## How this run was made

- Image `rivet-ssr2-node:base` = `Dockerfile.node` built from a `git archive` of `297388c58` (Node 26.11.1); backend / Razor / load generator images unchanged (`rivet-ssr-bench-{backend,dotnet}:latest`, `rivet-ssr-bench-load:v2`, generator sha `feca615ea273`). Compose project `rivet-ssr2`, port prefix `459`.
- `benchmark.py --skip-build --frameworks rivet-compiled,rivet-router,rivet-resume,dotnet,solid-stable-static,solid-stable-interactive,solid-stable,qwik-stable --duration 10 --warmup 3 --repeats 5 --prewarm 10 --gc tuned`, three batches: rows 100 / 1,000 / 5,000 c1; 1,000 c10; `--grid` 1,000 c1. 224 recorded trials, zero failed responses; strict validation as always. Lane order rotates per repeat.
- 1 CPU / 512 MiB per frontend, Docker Desktop Linux ARM64 VM on an Apple M4 Pro.
- **Host load (1-minute, max of before/after per trial): far above the 2026-10-28 run** (median 5.5 there). Other agent lanes ran builds, tests and browsers throughout. Per batch min / median / max: 100r c1 5.2 / 8.3 / 12.3; 1000r c1 8.3 / 12.2 / 15.4; 5000r c1 9.4 / 18.8 / 30.9; 1000r c10 20.1 / 38.5 / 68.1; grid 9.9 / 12.1 / 21.4. **Absolute numbers are therefore inflated for every lane** (Razor 1,000 rows CPU 2.03 vs 1.41 ms on 2026-10-28, Solid static 1.52 vs 1.23); the c10 batch ran at load up to 68 and is indicative only. Rank lanes within this run; compare to earlier runs only through ratios, and only for regressions confirmed by a paired A/B (below).

Each cell: median <sub>min–max</sub> (n trials).


### CPU ms/page

| lane | 100r c1 | 1000r c1 | 1000r c10 | 5000r c1 | 1000r c1 grid |
|---|---:|---:|---:|---:|---:|
| rivet-compiled | 0.21 <sub>0.13–0.24</sub> (n5) | 0.61 <sub>0.49–1.07</sub> (n5) | 0.50 <sub>0.45–0.59</sub> (n5) | 2.59 <sub>2.12–3.33</sub> (n5) | 1.90 <sub>1.85–1.99</sub> (n5) |
| rivet-router | 0.26 <sub>0.18–0.30</sub> (n5) | 0.88 <sub>0.63–0.94</sub> (n5) | 0.88 <sub>0.62–1.20</sub> (n5) | 3.31 <sub>2.49–4.29</sub> (n5) | 2.67 <sub>2.54–3.18</sub> (n5) |
| rivet-resume | 0.29 <sub>0.23–0.43</sub> (n5) | 1.41 <sub>1.07–1.73</sub> (n5) | 1.26 <sub>0.95–1.71</sub> (n5) | 5.28 <sub>4.88–5.65</sub> (n5) | 3.26 <sub>3.23–3.71</sub> (n5) |
| dotnet | 0.39 <sub>0.28–0.57</sub> (n5) | 2.03 <sub>1.45–2.32</sub> (n5) | 1.99 <sub>1.74–5.20</sub> (n5) | 13.29 <sub>12.77–16.57</sub> (n5) | 2.76 <sub>2.63–4.50</sub> (n5) |
| solid-stable-static | 0.22 <sub>0.17–0.24</sub> (n5) | 1.52 <sub>1.28–1.68</sub> (n5) | 1.65 <sub>1.44–2.87</sub> (n5) | 9.18 <sub>7.71–10.70</sub> (n5) | 3.20 <sub>3.02–3.45</sub> (n5) |
| solid-stable-interactive | 0.82 <sub>0.77–0.94</sub> (n5) | 6.34 <sub>6.15–7.97</sub> (n5) | 8.67 <sub>7.97–14.93</sub> (n5) | 41.94 <sub>39.88–52.46</sub> (n5) | 10.09 <sub>9.21–10.51</sub> (n5) |
| solid-stable | 0.70 <sub>0.64–0.73</sub> (n5) | 1.83 <sub>1.61–2.29</sub> (n5) | 3.10 <sub>2.59–5.34</sub> (n5) | 17.30 <sub>14.82–21.86</sub> (n5) | 4.07 <sub>3.86–4.42</sub> (n5) |
| qwik-stable | 4.41 <sub>4.36–4.95</sub> (n5) | 52.27 <sub>46.57–57.04</sub> (n5) | 56.44 <sub>49.91–89.71</sub> (n5) | 342.65 <sub>306.66–438.02</sub> (n5) | 61.50 <sub>58.65–63.98</sub> (n5) |

### rps

| lane | 100r c1 | 1000r c1 | 1000r c10 | 5000r c1 | 1000r c1 grid |
|---|---:|---:|---:|---:|---:|
| rivet-compiled | 2,442 <sub>2,203–3,812</sub> (n5) | 900 <sub>516–1,152</sub> (n5) | 1,724 <sub>1,452–1,881</sub> (n5) | 241 <sub>165–284</sub> (n5) | 338 <sub>328–345</sub> (n5) |
| rivet-router | 2,192 <sub>2,087–3,224</sub> (n5) | 709 <sub>633–1,074</sub> (n5) | 1,062 <sub>787–1,514</sub> (n5) | 215 <sub>153–283</sub> (n5) | 298 <sub>250–314</sub> (n5) |
| rivet-resume | 2,337 <sub>1,620–2,812</sub> (n5) | 534 <sub>433–713</sub> (n5) | 763 <sub>574–1,017</sub> (n5) | 158 <sub>145–170</sub> (n5) | 258 <sub>228–262</sub> (n5) |
| dotnet | 2,028 <sub>1,161–2,896</sub> (n5) | 440 <sub>371–615</sub> (n5) | 498 <sub>192–568</sub> (n5) | 66 <sub>53–72</sub> (n5) | 269 <sub>217–286</sub> (n5) |
| solid-stable-static | 2,665 <sub>2,457–3,409</sub> (n5) | 507 <sub>457–613</sub> (n5) | 577 <sub>331–665</sub> (n5) | 96 <sub>78–113</sub> (n5) | 238 <sub>221–253</sub> (n5) |
| solid-stable-interactive | 428 <sub>379–437</sub> (n5) | 143 <sub>114–147</sub> (n5) | 115 <sub>67–125</sub> (n5) | 23 <sub>18–24</sub> (n5) | 86 <sub>83–92</sub> (n5) |
| solid-stable | 374 <sub>373–390</sub> (n5) | 283 <sub>242–312</sub> (n5) | 321 <sub>186–384</sub> (n5) | 57 <sub>45–66</sub> (n5) | 166 <sub>154–172</sub> (n5) |
| qwik-stable | 227 <sub>202–229</sub> (n5) | 19 <sub>18–21</sub> (n5) | 18 <sub>11–20</sub> (n5) | 3 <sub>2–3</sub> (n5) | 16 <sub>16–17</sub> (n5) |

### p50 ms

| lane | 100r c1 | 1000r c1 | 1000r c10 | 5000r c1 | 1000r c1 grid |
|---|---:|---:|---:|---:|---:|
| rivet-compiled | 0.35 <sub>0.23–0.36</sub> (n5) | 0.86 <sub>0.71–1.47</sub> (n5) | 5.25 <sub>4.90–5.66</sub> (n5) | 3.31 <sub>2.73–4.85</sub> (n5) | 2.51 <sub>2.48–2.62</sub> (n5) |
| rivet-router | 0.39 <sub>0.27–0.39</sub> (n5) | 1.12 <sub>0.78–1.17</sub> (n5) | 7.71 <sub>6.00–10.70</sub> (n5) | 3.88 <sub>3.07–5.76</sub> (n5) | 2.90 <sub>2.78–3.38</sub> (n5) |
| rivet-resume | 0.38 <sub>0.31–0.51</sub> (n5) | 1.54 <sub>1.22–1.92</sub> (n5) | 11.42 <sub>8.91–13.77</sub> (n5) | 5.58 <sub>5.10–5.92</sub> (n5) | 3.47 <sub>3.39–3.82</sub> (n5) |
| dotnet | 0.41 <sub>0.30–0.64</sub> (n5) | 1.82 <sub>1.38–2.14</sub> (n5) | 16.70 <sub>15.30–67.09</sub> (n5) | 10.01 <sub>8.87–14.53</sub> (n5) | 3.26 <sub>3.07–3.84</sub> (n5) |
| solid-stable-static | 0.32 <sub>0.25–0.35</sub> (n5) | 1.58 <sub>1.30–1.78</sub> (n5) | 15.31 <sub>13.07–27.29</sub> (n5) | 10.01 <sub>8.84–11.88</sub> (n5) | 3.85 <sub>3.59–4.14</sub> (n5) |
| solid-stable-interactive | 2.13 <sub>2.04–2.76</sub> (n5) | 6.14 <sub>6.04–7.74</sub> (n5) | 82.27 <sub>75.01–145.22</sub> (n5) | 41.37 <sub>39.07–52.07</sub> (n5) | 10.96 <sub>10.27–11.34</sub> (n5) |
| solid-stable | 2.71 <sub>2.20–2.74</sub> (n5) | 3.25 <sub>3.00–3.85</sub> (n5) | 30.20 <sub>24.54–49.99</sub> (n5) | 15.20 <sub>13.18–19.95</sub> (n5) | 5.42 <sub>5.14–5.83</sub> (n5) |
| qwik-stable | 3.03 <sub>2.95–3.47</sub> (n5) | 51.81 <sub>45.39–55.38</sub> (n5) | 551.43 <sub>493.21–885.17</sub> (n5) | 338.07 <sub>307.73–432.04</sub> (n5) | 59.15 <sub>57.04–61.59</sub> (n5) |

### TTFB p50 ms

| lane | 100r c1 | 1000r c1 | 1000r c10 | 5000r c1 | 1000r c1 grid |
|---|---:|---:|---:|---:|---:|
| rivet-compiled | 0.33 <sub>0.22–0.35</sub> (n5) | 0.68 <sub>0.56–1.19</sub> (n5) | 5.08 <sub>4.75–5.47</sub> (n5) | 2.23 <sub>1.78–3.18</sub> (n5) | 2.09 <sub>2.08–2.20</sub> (n5) |
| rivet-router | 0.38 <sub>0.26–0.38</sub> (n5) | 0.95 <sub>0.65–1.00</sub> (n5) | 7.54 <sub>5.86–10.41</sub> (n5) | 2.68 <sub>2.07–3.85</sub> (n5) | 2.49 <sub>2.37–2.88</sub> (n5) |
| rivet-resume | 0.37 <sub>0.30–0.49</sub> (n5) | 1.18 <sub>0.90–1.50</sub> (n5) | 10.99 <sub>8.60–13.13</sub> (n5) | 3.23 <sub>2.93–3.44</sub> (n5) | 2.57 <sub>2.51–2.88</sub> (n5) |
| dotnet | 0.39 <sub>0.30–0.60</sub> (n5) | 1.33 <sub>0.97–1.59</sub> (n5) | 8.19 <sub>7.23–18.03</sub> (n5) | 6.36 <sub>5.40–9.65</sub> (n5) | 2.67 <sub>2.51–3.11</sub> (n5) |
| solid-stable-static | 0.31 <sub>0.24–0.34</sub> (n5) | 1.46 <sub>1.20–1.63</sub> (n5) | 15.12 <sub>12.92–26.89</sub> (n5) | 9.34 <sub>8.30–10.57</sub> (n5) | 3.65 <sub>3.40–3.90</sub> (n5) |
| solid-stable-interactive | 2.11 <sub>2.03–2.72</sub> (n5) | 5.97 <sub>5.88–7.49</sub> (n5) | 81.72 <sub>74.58–144.86</sub> (n5) | 40.20 <sub>38.05–50.37</sub> (n5) | 10.64 <sub>9.99–10.98</sub> (n5) |
| solid-stable | 2.66 <sub>2.17–2.69</sub> (n5) | 3.11 <sub>2.89–3.67</sub> (n5) | 29.88 <sub>24.26–49.42</sub> (n5) | 14.35 <sub>12.32–18.56</sub> (n5) | 5.19 <sub>4.94–5.59</sub> (n5) |
| qwik-stable | 2.98 <sub>2.89–3.40</sub> (n5) | 8.19 <sub>7.74–8.50</sub> (n5) | 499.99 <sub>446.37–780.64</sub> (n5) | 11.97 <sub>10.19–15.71</sub> (n5) | 8.49 <sub>8.18–9.26</sub> (n5) |

### peak MiB

| lane | 100r c1 | 1000r c1 | 1000r c10 | 5000r c1 | 1000r c1 grid |
|---|---:|---:|---:|---:|---:|
| rivet-compiled | 61.0 <sub>60.5–63.3</sub> (n5) | 68.5 <sub>67.3–69.8</sub> (n5) | 101.7 <sub>101.0–105.2</sub> (n5) | 75.2 <sub>73.4–77.0</sub> (n5) | 85.7 <sub>85.2–88.8</sub> (n5) |
| rivet-router | 72.8 <sub>71.6–80.2</sub> (n5) | 88.6 <sub>83.2–91.4</sub> (n5) | 131.4 <sub>130.5–133.2</sub> (n5) | 96.3 <sub>93.0–98.4</sub> (n5) | 106.9 <sub>106.4–107.7</sub> (n5) |
| rivet-resume | 86.1 <sub>83.7–90.1</sub> (n5) | 97.7 <sub>93.8–100.0</sub> (n5) | 163.3 <sub>153.4–165.5</sub> (n5) | 113.7 <sub>108.7–116.9</sub> (n5) | 111.0 <sub>110.0–113.1</sub> (n5) |
| dotnet | 107.0 <sub>106.5–107.3</sub> (n5) | 115.1 <sub>114.5–117.2</sub> (n5) | 226.9 <sub>213.0–241.5</sub> (n5) | 140.4 <sub>139.5–146.1</sub> (n5) | 131.1 <sub>130.8–133.0</sub> (n5) |
| solid-stable-static | 72.8 <sub>71.8–74.3</sub> (n5) | 97.7 <sub>94.2–106.4</sub> (n5) | 158.0 <sub>153.9–161.1</sub> (n5) | 118.2 <sub>117.5–122.5</sub> (n5) | 102.7 <sub>100.7–103.8</sub> (n5) |
| solid-stable-interactive | 84.6 <sub>83.9–87.5</sub> (n5) | 142.8 <sub>140.6–144.9</sub> (n5) | 204.3 <sub>192.5–213.1</sub> (n5) | 184.1 <sub>180.8–187.4</sub> (n5) | 145.9 <sub>142.8–147.5</sub> (n5) |
| solid-stable | 61.9 <sub>60.9–65.8</sub> (n5) | 96.3 <sub>94.9–98.9</sub> (n5) | 145.2 <sub>143.9–151.8</sub> (n5) | 126.3 <sub>124.7–135.0</sub> (n5) | 109.7 <sub>108.8–111.7</sub> (n5) |
| qwik-stable | 85.2 <sub>84.0–131.0</sub> (n5) | 126.4 <sub>125.9–127.2</sub> (n5) | 197.8 <sub>186.8–200.2</sub> (n5) | 243.4 <sub>238.5–244.0</sub> (n5) | 138.9 <sub>138.5–139.8</sub> (n5) |

### KB

| lane | 100r c1 | 1000r c1 | 1000r c10 | 5000r c1 | 1000r c1 grid |
|---|---:|---:|---:|---:|---:|
| rivet-compiled | 68.4 <sub>68.4–68.4</sub> (n5) | 688.5 <sub>688.5–688.5</sub> (n5) | 688.5 <sub>688.5–688.5</sub> (n5) | 3,488.5 <sub>3,488.5–3,488.5</sub> (n5) | 1,083.6 <sub>1,083.6–1,083.6</sub> (n5) |
| rivet-router | 68.5 <sub>68.5–68.5</sub> (n5) | 688.6 <sub>688.6–688.6</sub> (n5) | 688.6 <sub>688.6–688.6</sub> (n5) | 3,488.6 <sub>3,488.6–3,488.6</sub> (n5) | 1,083.7 <sub>1,083.7–1,083.7</sub> (n5) |
| rivet-resume | 78.2 <sub>78.2–78.2</sub> (n5) | 733.4 <sub>733.4–733.4</sub> (n5) | 733.4 <sub>733.4–733.4</sub> (n5) | 3,693.4 <sub>3,693.4–3,693.4</sub> (n5) | 1,128.5 <sub>1,128.5–1,128.5</sub> (n5) |
| dotnet | 68.4 <sub>68.4–68.4</sub> (n5) | 688.5 <sub>688.5–688.5</sub> (n5) | 688.5 <sub>688.5–688.5</sub> (n5) | 3,488.5 <sub>3,488.5–3,488.5</sub> (n5) | 1,083.6 <sub>1,083.6–1,083.6</sub> (n5) |
| solid-stable-static | 68.3 <sub>68.3–68.3</sub> (n5) | 688.4 <sub>688.4–688.4</sub> (n5) | 688.4 <sub>688.4–688.4</sub> (n5) | 3,488.4 <sub>3,488.4–3,488.4</sub> (n5) | 1,080.6 <sub>1,080.6–1,080.6</sub> (n5) |
| solid-stable-interactive | 81.2 <sub>81.2–81.2</sub> (n5) | 824.7 <sub>824.7–824.7</sub> (n5) | 824.7 <sub>824.7–824.7</sub> (n5) | 4,228.7 <sub>4,228.7–4,228.7</sub> (n5) | 1,620.9 <sub>1,620.9–1,620.9</sub> (n5) |
| solid-stable | 70.1 <sub>70.1–70.1</sub> (n5) | 706.4 <sub>706.4–706.4</sub> (n5) | 706.4 <sub>706.4–706.4</sub> (n5) | 3,582.4 <sub>3,582.4–3,582.4</sub> (n5) | 1,098.5 <sub>1,098.5–1,098.5</sub> (n5) |
| qwik-stable | 93.6 <sub>93.6–93.6</sub> (n5) | 944.9 <sub>944.9–944.9</sub> (n5) | 944.9 <sub>944.9–944.9</sub> (n5) | 4,790.2 <sub>4,790.2–4,790.2</sub> (n5) | 1,340.0 <sub>1,340.0–1,340.0</sub> (n5) |


## Reading

- **Static (`rivet-compiled`)** wins CPU / page against Razor and Solid 1 static at 1,000 and 5,000 rows (0.61 vs 2.03 / 1.52 ms; 2.59 vs 13.3 / 9.2 ms) and on the **text grid against Razor: 1.90 vs 2.76 ms CPU, 338 vs 269 rps, p50 2.51 vs 3.26 ms, TTFB 2.09 vs 2.67 ms, 86 vs 131 MiB** (2026-10-28: CPU TIE 1.89 vs 2.29). 100 rows c1 is latency-bound and noisy: CPU 0.21 vs Solid static 0.22 (TIE), rps 2,442 vs 2,665 (ranges overlap, 2,203–3,812 vs 2,457–3,409).
- **Resumable (`rivet-resume`)** beats every hydratable / resumable peer on CPU, rps, p50, TTFB at every case (1,000 rows CPU 1.41 vs Solid 1 hydratable 1.83 / with interactive rows + data 6.34 / Qwik 1 52.3 ms). Peak memory: 1,000 rows 97.7 vs Solid 1 hydratable 96.3 MiB (TIE, was LOSE), 5,000 rows 114 vs 126 (WIN); 100 rows still 86 vs 62 MiB (LOSE, the known V8 high-water at 100 rows, `apps/ssr-bench/CLAUDE.md` gotchas). HTML bytes: 733 KB vs 706 (Solid 1 hydratable), 825 (Solid interactive), 945 (Qwik 1).
- **Remaining loss vs Razor: the resumable app on the text grid** (not like-for-like: Razor ships no resume data): CPU 3.26 vs 2.76 ms, p50 3.47 vs 3.26 ms, TTFB 2.57 vs 2.67 (TIE). SSR2 below attacks it.

## Regression check vs 2026-10-28

- Absolute Docker numbers of every lane rose with host load (above). Ratios moved more for the heavier Rivet lanes (resume / Razor CPU at 1,000 rows 0.69 vs 0.62 on 2026-10-28; at 5,000 rows 0.40 vs 0.27), so the Rivet code was checked directly, interleaved, against `2c51055a8` (the commit the 2026-10-28 run measured):
  - in-process router handler (`apps/ssr-bench/spikes/segments/ab.mjs`, 7 rounds, load ~8, CPU µs / request, base vs old): `/resume` 100 rows 169.5 vs 172.4, 1,000 939 vs 920, grid 1,000 1,812 vs 1,795, `/page` 1,000 610 vs 601, `/resume` 5,000 5,942 vs 5,921;
  - through the production node adapter over HTTP (`spikes/segments/http.mjs` with per-lane roots, fresh server per lane and round, 5 rounds × 5 s, c1, load 17–30, server CPU µs / request, p50): `/resume` 1,000 769 / 0.756 ms vs 776 / 0.761; 5,000 2,824 / 2.76 vs 2,837 / 2.77; `/page` 1,000 463 vs 470; 5,000 1,721 vs 1,672;
  - allocation per request (`v8` `total_allocated_bytes`, in-process): `/resume` 100 rows 287 vs 323 KB, 1,000 613 vs 766 KB, grid 1,383 vs 1,560 KB; `/page` 1,000 396 vs 397 KB.
- **Verdict: no regression** in the Rivet server path since 2026-10-28 (all paired deltas within ±3 %, allocation lower); the Docker ratio drift is host contention (the heavier, longer requests suffer more from a contended VM).

## SSR2: DOM data "kept" proof from the row emitter

- **Cause** (CPU profile, in-process router handler, `node --cpu-prof` over `/resume?rows=1000&strings=2`): the DOM-data checker's per-string `KEPT` regex (`/[\r\0]|lone surrogate/`, `server-derived-dom.ts`) was **8.8 % self time** of the text-grid resumable render, **7.4 %** of the escaping one (`strings=1`) — ~13–20 ns × 10,000 strings per page, the largest single frame after the wasm emitter and `_listRows`.
- **Change**: DOM data registers each list tape (`server-rows-shown.ts` `shownRows`, n = 0); the row emitter (`server-rows.ts`), which already joins each chunk's strings into one flat string for its single UTF-8 write, proves the chunk with two `indexOf` (memchr) for CR / NUL plus bytes = units (ASCII) or one `isWellFormed`, extending the tape's proven row prefix. A list whose rows are all proven skips the regex; anything else (string writer, per-row fallback, an early surrogate-edge write, an unproven chunk) keeps it. Output byte-identical (sha of `/resume` 1,000 / 5,000 grid, strings, ints, `/page` grid; base = new).
- **After** (same profile): the regex frame is gone on grid and strings; wasm / `_listRows` unchanged. Static lanes do not register tapes: one WeakMap read per `_listRows` call.
- **Dropped first attempt** (measured): flagging CR / NUL / U+FFFD inside the wasm SIMD loop (two more compares, or a nibble-table classifier): `emit` alone +12 % on grid strings (200-row chunk 19.6 → 22.3 µs), +8 % escaping, even with the added branches never executed; it would have taxed the static Razor-adversarial lane.
- **Interleaved A/B, host load 24–55** (other lanes' builds / browsers; inconclusive at this load, the effect is below the noise):
  - in-process, separate processes alternating (`.lane/abp.mjs`, 11 rounds × 300-request samples, CPU µs / request median [min–max], load 24–26): `/resume` grid 1,000 base 1,229 [1,172–1,682] → new 1,178 [1,080–1,733] (−4 %); escaping 1,691 [1,547–2,322] → 1,477 [1,020–2,034] (−13 %); ints 1,054 → 1,004 (no code change on that path: noise scale); `/page` grid 1,127 [648–1,553] → 1,283 [897–1,633] (no code change: noise scale).
  - Docker (`run-ab.sh`: base / new images alternating per round, 5 rounds × {grid, strings} × {rivet-resume, rivet-compiled}, 10 s trials, load 12–55): paired new / base CPU per page median rivet-resume grid 0.953 [0.749–1.355], strings 0.995 [0.877–1.398]; control rivet-compiled grid 1.033 [0.901–1.345], strings 1.003 [0.798–1.171]. Medians: rivet-resume grid 3.78 → 3.87 ms, strings 2.74 → 3.31 ms; rivet-compiled grid 2.23 → 2.60, strings 1.93 → 1.94. The control lane (same code path as before but one WeakMap read) moves as much as the treated one: noise.
  - Expected under a quiet host from the profile share: −8 % render CPU on a 1,000-row text-grid `/resume`, −7 % escaping; in Docker (render ≈ half the page CPU) ~−4 % / −3 %. Re-measure at load < 6 before claiming a Docker delta.
- Zero-cost (`sh scripts/zero-cost/check.sh`, not updated): `@rivetjs/runtime/server` 55,361 → 55,555 B (+194), `server-resume [domData]` 67,939 → 68,079 (+140), `server-derived [domData]` 90,138 → 90,284 (+146); lane bundles `rivet-compiled.mjs`, `rivet-for.mjs`, `rivet-router/server/entry.server.js` changed (server-rows); Qwik lane files differ too (Qwik build nondeterminism, also seen by lane SSR-STREAM with no Qwik change). Dev leaks none (269), condition parity ok (21), 176/176 corpus. No client bytes.
