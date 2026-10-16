# Handwritten direct SSR prototype

> Archived: the `apps/ssr-bench/experiments/` sources, probes and snapshots referenced here were removed after commit `876929e`; run commands and links below resolve at that commit (`git show 876929e:<path>`).


The [plan](../../design/plans/2026-10-02-rivet-direct-ssr-optimisation.md) now has a handwritten JavaScript target under `apps/ssr-bench/experiments/direct/prototype.mjs`. It emits unrolled, context-escaped row HTML without template records or slot graphs, using the existing synchronous-or-acknowledged writer contract. This is a diagnostic control, not compiler-generated output.

Its contract deliberately accepts ordinary own-data primitive fields. Accessors and object/function/symbol scalars are rejected before output. This validation does not prove arbitrary JavaScript purity or proxy safety. `eager` captures scalar row values before the first write; `incremental` reads row values after prior acknowledgments. A mutation test demonstrates that these modes differ. The frozen benchmark data makes both outputs equivalent; this does not justify transforming arbitrary JSX `.map()` into deferred iteration.

The mixed fixture handles primitive text and native promises, admits formed promise rejections before writing, and resumes in order. Boolean scalars become text (`false` becomes `"false"`), unlike JSX child omission. It is not the product's generic async/ownership bridge and does not support arbitrary thenables, context providers, or component results. Those semantics belong to later plan tasks.

Fourteen focused validated-prototype/control tests pass after the cancellation repair: full byte parity with the existing hand emitter, all ten fields, text/attribute escaping and lone surrogates; malformed/accessor rejection; delayed/reused/failing acknowledgments; cancellation and drain listener release; interleaved request isolation; capture timing; formed rejection admission; RPC consumption; labelled HTTP controls and all four full-render lane outputs.

The matched-writer host diagnostic ran five rotated repeats at 100/1,000/5,000 rows, with 20 warmup and 100 measured pages per lane/repeat. The existing host compiled artifact is 9,242 bytes, SHA-256 `df1260bdf8642d3202b83ec10f5cb72c0b1c36f7043d462c29c89b7174493e5f`; it differs from the separately preserved current Docker artifact. Complete bodies matched at every size. Raw samples, exact artifact/source fingerprints and output hashes are saved in [the diagnostic JSON](direct-ssr-pure-diagnostic.json). All four lanes use default 16 KiB `NodeStreamWriter` batching and UTF-8 byte accounting before reaching the same observable discard sink.

Median active process CPU per page:

| Rows | Compiled Rivet | Existing hand emitter | Direct eager | Direct incremental |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 0.219 ms | 0.101 ms | 0.133 ms | 0.123 ms |
| 1,000 | 1.738 ms | 0.861 ms | 1.216 ms | 1.182 ms |
| 5,000 | 9.336 ms | 4.241 ms | 6.393 ms | 5.986 ms |

At 5,000 rows the prototype uses roughly 31.5–35.9% less CPU than compiled output, but remains roughly 41–51% more expensive than the existing hand emitter. The prototype additionally validates every own-property descriptor and the eager mode allocates captures. These differences require profiling before attributing the gap. There is no basis to call this a successful compiler backend or a .NET win.

Physical sink-write boundaries can differ because atomic input chunks differ even with the same batching threshold. The [initial unmatched-writer probe](direct-ssr-unmatched-writer-diagnostic.json) is retained for audit but is not the comparison above: it omitted writer buffering/UTF-8 accounting for the hand/direct controls. Host execution has no Docker CPU quota, and timings include sequential adapter scheduling. Heap before/after values are live-heap drift, not allocation volume or post-GC retained memory.

The [live Docker/gRPC diagnostic](direct-ssr-http-diagnostic.json) also passes complete fixture validation. At 5,000 rows median full-request frontend CPU was 29.791 ms compiled, 24.825 ms hand, 26.814 ms eager direct and 27.670 ms incremental direct. Complete-response medians were approximately 25.485, 20.084, 23.135 and 23.098 ms respectively. Mean actual first-write intervals, summarised by median across repeats, were 8.290, 3.752, 8.062 and 7.534 ms. These are separate group summaries, not paired confidence estimates. Both direct modes remain behind the existing hand emitter; additional validation is still part of their cost.

The pure-render advantage does not translate into a large end-to-end win in this short diagnostic. Separate [allocation/CPU sampling](direct-ssr-profiles.md) now identifies descriptor allocation and capture/string/traversal frames as investigation targets. Generic ownership/async equivalence, retained-heap analysis and the planned matched Razor decision experiment remain unmet. Tasks 1–2 remain open.

The timing and profile evidence above used the pre-repair source, preserved in the exact measured snapshot (removed from the tree in `db7a4667`: `git show db7a4667^:apps/ssr-bench/experiments/direct/snapshots/prototype-measured-before-ack-fix.txt`), SHA-256 `b282af2b56b2b6e20f0e858f2b780c85e8c0a3e272aa089322c40fca5188f844`. Current source verification hashes are recorded separately in [the provenance](direct-ssr-diagnostic-provenance.json). No historical measurement JSON was changed and no post-repair speed claim is made.

Current `emitDirect` and `emitMixed` race pending writer acknowledgments against the caller signal. Mixed emission also races a pending native child promise, while observing all admitted sibling rejections before writing. Cancellation rejects promptly even when the acknowledgment or child never settles; an aborted final acknowledgment and cancellation inside the final accepted write reject completion. Success, failure, assimilation errors and cancellation remove signal listeners. Late settlements never resume aborted emission. The synchronous accepted-write loop, eager/incremental capture difference, descriptor checks and existing scalar-only mixed escaping remain intact. This mixed diagnostic is not general JSX boolean/null/array semantics.

Request data and continuation cells are cleared deterministically after completion, failure or cancellation; a forever-pending external promise may retain a small cleared reaction cell. These tests establish cleanup behaviour, not a heap bound or producer-side promise cancellation. All thirty direct-diagnostic tests pass, including the actual `NodeStreamWriter` drain/abort contract and concurrent request isolation. Task 2 remains open for broader generic/mixed equivalence, ownership, compiler eligibility and controlled retained-heap/concurrent-load gates.
