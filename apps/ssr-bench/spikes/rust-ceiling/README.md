# rust-ceiling — THROWAWAY SPIKE (2026-10-06)

Not a product, not a lane of the regular bench, not maintained. Answers one question: how fast could the ssr-bench page go if server rendering ran natively in Rust instead of V8? Results + verdict: [docs/benchmarks/2026-10-06-rust-ceiling-spike.md](../../../../docs/benchmarks/2026-10-06-rust-ceiling-spike.md).

- `src/render.rs` — hand-written stand-in for what a native compile target would emit for `adapters/rivet-compiled.jsx`: pre-encoded static `&[u8]` runs + `rt::{text,attr,int}` holes, resumable row loop yielding 32 KiB chunks from a pooled `BytesMut`.
- `src/page.rs` — prost messages for `proto/content.proto` (hand-written, no protoc) + JSON shape of the JS DTO (`values: (number|string)[]`).
- `src/main.rs` — hyper 1 HTTP/1.1 server, tonic gRPC client to the same backend, `/page` `/health` `/metrics` like `server.ts`. Env `WORKERS` (1 = tokio current_thread), `INPUT` (`proto` | `json-serde` | `json-simd`). `rust-ceiling bench` = in-process micro-bench.
- Output is byte-identical to `rivet-compiled` (incl. the doubled `<!--complete-->`), passes `loadgen/validate.ts`. `article=1` → 400 (no markdown renderer).
- `node-micro.mjs` — Node counterpart micro-bench (rivet-compiled render-only, JSON.stringify/parse); run in `rivet-ssr-bench-node:local` with `-v $PWD:/m`.
- `compose.rust.yaml` + `bench.py` — run next to the regular lanes without touching `compose.yaml`/`benchmark.py`:

```sh
SSR_BENCH_PROJECT=rivet-ssr-rspike SSR_BENCH_PORT_PREFIX=182 python3.12 apps/ssr-bench/spikes/rust-ceiling/bench.py \
  --frameworks=rivet-compiled,dotnet,rust-ceiling,rust-ceiling-mt,rust-ceiling-json --rows=100,1000 --concurrency=1,10,100 \
  --duration=10 --warmup=3 --repeats=3 --skip-build --generator-cpus=4 --stop --out .artifacts/ssr-bench-rspike
docker run --rm --cpus=1 rivet-ssr-bench-rust-ceiling:spike rust-ceiling bench
```

Rust toolchain only inside Docker (`rust:1.85.1-bookworm`, pinned digest); `Cargo.lock` pins every crate. Delete this directory when the native-target decision is made.
