# Experimental paired HTTP/2 transport screen

`http2.mjs` compares HTTPS/1.1 and HTTP/2 for the same already-built Rivet resume fixture. It changes neither product servers nor fixture assets and makes no framework ranking. By default, generated certificates and results stay in the ignored `.artifacts/http2-bench` directory.

## Run

Use Node 24+, the checkout's installed dependencies, Playwright Chromium, and `openssl`. Build the fixture and prepare the local certificate before measuring. From the repository root:

```sh
# Build and verify the fixture; run separately from transport measurement.
node apps/resume-bench/run.ts --lanes rivet --build --verify
node apps/resume-bench/http2.mjs --prepare

# Four fast H1/H2 load/click correctness checks; timings are not performance evidence.
node apps/resume-bench/http2.mjs --verify-only

# Five alternating pairs per condition, fast and Slow4G, load only: 20 navigations.
node apps/resume-bench/http2.mjs --repeats 5 --conditions fast,slow --scenarios load

# Optional separate first-click screen.
node apps/resume-bench/http2.mjs --repeats 5 --conditions fast,slow --scenarios click
```

Do not run comparative timing alongside builds, tests, other benchmarks, or unrelated heavy workloads. The script never builds the fixture. It checks fixture hashes before and after a run and rejects a concurrent rebuild.

Options are `--repeats 1..10`, `--conditions fast,slow`, `--scenarios load,click`, `--prepare`, `--verify-only`, and `--out PATH`. The default result is `.artifacts/http2-bench/runs/<UTC-run-id>/results.json`. An explicit `--out` keeps its usual filesystem-path behavior; prefer a fresh directory under `.artifacts` to preserve prior evidence and avoid checking in generated files. A 15-minute run deadline, 45-second navigation timeout, and 30-second action timeout bound failures.

The self-signed localhost certificate lasts seven days; its private key uses mode `0600`. Both arms use `ignoreHTTPSErrors: true`; no system trust settings change. If preparation reports an expired or incomplete pair, remove only `.artifacts/http2-bench/certs` and prepare again outside timing.

## Controls and recorded evidence

- Both arms use one warmed `serve.ts` upstream, one shared HTTP/1.1 keep-alive agent, identical Brotli bodies, TLS 1.3, browser settings, and fixture data. Every fixture file is prewarmed before trials.
- Each trial creates a fresh TLS edge origin and browser context. Browser caches and service workers are disabled. H1 advertises only `http/1.1`; H2 rejects H1 fallback and disables push. The streaming proxy removes hop-by-hop headers without adding a cache or changing compression.
- Trial order alternates H1/H2 and H2/H1 by repeat. Fast is unthrottled; slow uses 150 ms CDP latency, `1.6 * 1024 * 1024 / 8` B/s download, `750 * 1024 / 8` B/s upload, and 4× CPU, matching the resumability benchmark.
- Validation checks all 1,000 row identities, labels, links, and pick controls, plus the initial counter, empty filter, and closed panel. The click scenario must increment the counter to one. Browser protocol/TLS and proxy ALPN are checked for the document and recorded assets; completed proxy payload lengths/encodings must match the prewarmed files.
- Results retain fixture/source hashes, browser and Node versions, certificate fingerprint, raw request protocol/status/timing/connection/cache/completion data, encoded bytes, proxy transfers, DOM validation, and errors. Page/CDP sessions, downstream sockets, upstream requests, agents, and servers close on completion or failure.

Load observes three seconds after the load event. Click waits one second, dispatches trusted mouse down/up without mouse movement or hover dwell, and observes another 500 ms after the update. Both scenarios begin with cold navigation.

## Interpretation

The report saves DOMContentLoaded fixture readiness, load end, document response end, TTFB, TLS time, FCP, and optional first-click latency. DOM readiness means the SSR structure exists; it does not establish that every lazy handler is loaded. Script and idle-analytics observations remain in the raw report.

Summaries include each arm's median and every signed H2-minus-H1 paired delta. Failed pairs remain visible but are excluded from summaries. Inspect request sets, encoded payloads, unfinished transfers, and errors before interpreting a latency change. Five pairs are a screening sample.

CDP Slow4G emulates browser network conditions; it does not reproduce packet-level WAN congestion, loss, or Internet deployment behavior. Fast loopback is also a transport control. These results do not measure renderer speed or establish a general HTTP/2 advantage. A useful screen can motivate more paired samples and packet-level network experiments.

References: [Node HTTP/2 compatibility API](https://nodejs.org/api/http2.html#compatibility-api), [ALPN negotiation](https://nodejs.org/api/http2.html#alpn-negotiation), [Resource Timing `nextHopProtocol`](https://www.w3.org/TR/resource-timing/#dom-performanceresourcetiming-nexthopprotocol), and [HTTP/2 specification](https://httpwg.org/specs/rfc9113.html#section-2).
