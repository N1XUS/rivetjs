# Closed plain-data direct emission control

> Archived: the `apps/ssr-bench/experiments/` sources, probes and snapshots referenced here were removed after commit `876929e`; run commands and links below resolve at that commit (`git show 876929e:<path>`).


This follow-up to [the attribution profiles](direct-ssr-profiles.md) removes descriptor validation from a separate laboratory control. The original measured validated prototype is archived; its current source has a separate cancellation repair. Drivers, reports and product default behaviour remain unchanged. No product compiler/runtime change is implied.

`trusted-prototype.mjs` accepts the benchmark's ordinary own-data primitive fields, never arbitrary components/getters/proxies/object coercion. It checks the row-array/ten-field shape but does not prove that properties are pure or enforce a general JavaScript source subset. Public `escapeText`/`escapeAttribute` functions remain in use. Complete bytes match the existing hand emitter for numeric fixtures and hostile primitive strings, including null, false, zero, BigInt and lone surrogates.

Eager mode creates one flat scalar capture array per request; every id/field conversion is inside the measured call. Incremental mode converts fields when its row is emitted. Captures and HTML are never cached across requests. These modes intentionally differ when data mutates after a writer acknowledgment; the frozen pure fixture and controlled gRPC data make the comparison well-defined without establishing arbitrary JSX equivalence. The current trusted prototype stops further rows on writer errors/cancellation, handles repeated acknowledgment promises separately, and isolates concurrent captures.

`controls-trusted.mjs` adds `/rpc-numeric` while retaining `/rpc` as the original String/FNV consumption control. The new control validates exact numeric int32 row identities and all ten expected values, then combines one integer hash per id/field. It also checks the fixture title and request token. It is not a replacement gRPC protocol, and its timing must not be silently substituted into the previous report or subtracted from full-render CPU.

The host driver independently checks known fixture checksums outside frontend timings: 100 rows → 972863885; 1,000 → 2818744149; 5,000 → 1814090837. These constants were cross-checked using Python's exact integer arithmetic modulo 2³². Every HTML response still validates every field and complete delivery. Synthetic prepared-body reuse remains solely in the separately labelled transport control.

Eleven focused trusted tests pass after the acknowledgment cancellation repair. Matched-writer pure rendering and Docker/gRPC diagnostics now pass full output/checksum oracles. Exact source/artifact/resource identities and evidence fingerprints are saved in [the provenance JSON](direct-ssr-trusted-provenance.json). The immutable Docker image remains `c933975b…`, one CPU/512 MiB frontend, two CPU/1 GiB shared backend. The host driver has no resource quota. Both trusted pure and Docker HTTP result files record the same actual compiled artifact `709d044c…`, 9,242 bytes. The host artifact `df1260…` belongs to the earlier diagnostics only. No builds/tests/profiles ran during either timing window.

The [pure-render diagnostic](direct-ssr-trusted-pure-diagnostic.json) contains ninety trials: six lanes × three sizes × five rotated repeats, twenty warmup and one hundred measured pages per trial. Every complete body matched before timing, and the timed sink observed the complete output. All use the same default `NodeStreamWriter` UTF-8 accounting and buffering; atomic input chunk boundaries may differ. Capturing, conversions and row-shape checks happen within every measured invocation.

Median active host process CPU per page:

| Rows | Compiled | Hand | Validated eager | Validated incremental | Trusted eager | Trusted incremental |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 0.233 ms | 0.105 ms | 0.131 ms | 0.123 ms | 0.089 ms | 0.085 ms |
| 1,000 | 1.732 ms | 0.863 ms | 1.234 ms | 1.174 ms | 0.795 ms | 0.825 ms |
| 5,000 | 9.359 ms | 4.262 ms | 6.454 ms | 5.934 ms | 4.331 ms | 4.222 ms |

At 5,000 rows the trusted eager shape is about 1.6% more expensive than hand at group medians, and incremental about 0.9% less. Removing the descriptor walk makes this experimental shape approach hand-emitter performance; it does not prove the semantic eligibility of a generated backend. Warmed host measurements are not the planned competitive SSR comparison.

The [Docker HTTP diagnostic](direct-ssr-trusted-http-diagnostic.json) contains 135 trials: nine distinct lanes × three sizes × five rotated repeats, ten measured and three warmup responses per trial. All 1,350 measured and 405 warmup responses completed and validated, with no failures or OOM. Full-request frontend CPU includes gRPC, rendering, metrics requests and background GC. Client validation between admissions changes the load shape.

Median frontend process CPU per complete response:

| Rows | Original String/FNV RPC | Numeric RPC | Compiled full | Hand full | Trusted eager full | Trusted incremental full |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 0.657 ms | 0.612 ms | 1.911 ms | 0.862 ms | 0.813 ms | 0.692 ms |
| 1,000 | 2.389 ms | 0.916 ms | 7.373 ms | 5.043 ms | 5.037 ms | 4.639 ms |
| 5,000 | 14.335 ms | 5.599 ms | 30.480 ms | 26.029 ms | 26.340 ms | 27.305 ms |

At 5,000 rows trusted full-request CPU paired-repeat ratios versus hand are 1.001 eager and 0.974 incremental, but individual ratios vary (eager 0.836–1.065; incremental 0.888–1.156). These paired summaries differ from ratios of the group medians in the table. Five short, correlated repeats do not establish statistical confidence or an end-to-end winner.

Group complete-response medians at 5,000 rows are 26.189 ms compiled, 21.603 ms hand, 21.315 ms trusted eager and 21.268 ms trusted incremental. Median repeat mean intervals to the first actual response write are 8.474, 4.040, 6.463 and 5.396 ms respectively. The eager mode's first write is roughly 60% later than hand; preserving eager captures therefore has a visible streaming tradeoff even when complete response approaches hand. These intervals are not client TTFB.

The cheaper numeric consumption control shows why the original character-based checksum cannot establish a gRPC/decoding CPU floor: its consumption strategy performs substantially more work. Both controls validate every expected field, but neither is a perfectly additive replacement for the full pipeline. Their CPU must not be subtracted from full request CPU or equated to a .NET total.

Thirty single-inflight slow-client cycles paused after headers, then closed the client. Twenty-six reached server cancellation; four responses finished before cancellation arrived. No failures occurred. Recovery RSS was about 125.5–127.1 MiB in the warmed process, including prepared-body caches, without forced GC. This is not retained heap or a concurrency bound. The isolated container was removed after evidence capture.

Task 3 protocol/design work has enough evidence to investigate a direct representation: the desired closed-data output shape reaches the hand-emitter cost range without descriptor validation. Compiler eligibility, eager/coercion ordering, formed async rejection admission, owner restoration and generic interoperation remain unproven. This is design readiness, not compiler/default adoption; no .NET comparison or general performance ranking is claimed.

The trusted measurements above predate a generic acknowledgment cancellation repair. Their exact source is preserved in the measured snapshot (removed from the tree in `db7a4667`: `git show db7a4667^:apps/ssr-bench/experiments/direct/snapshots/trusted-prototype-measured-before-ack-fix.txt`); the recorded measured hash remains unchanged. Current trusted emission races pending acknowledgments against the caller signal, rejects an aborted final acknowledgment, checks cancellation after a synchronously accepted footer, and removes listeners on success, failure or cancellation. Acknowledgment assimilation failures also clean up. Late acknowledgment fulfillment/rejection does not resume aborted emission. Captures and request continuations are cleared deterministically; this is not a heap-retention proof. Correctness tests were rerun, but no post-fix timing claim is made.

The measured validated `emitDirect`/`emitMixed` versions had the same generic pending/final acknowledgment cancellation limitation. Their archived measured source (removed from the tree in `db7a4667`: `git show db7a4667^:apps/ssr-bench/experiments/direct/snapshots/prototype-measured-before-ack-fix.txt`) preserves that evidence. Current validated emission now has a separately verified cancellation repair, including pending native mixed children; see [the validated prototype notes](direct-ssr-prototype.md). The historical measured `NodeStreamWriter` path had its own cancellation support, which explains why its HTTP abort diagnostics passed. Task 2 remains incomplete for the broader semantic and retained-heap gates; only the closed-fixture output-shape experiment is ready to inform Task 3 design.
