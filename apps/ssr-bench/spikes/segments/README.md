# Lane ZERO SEGMENTS harness (THROWAWAY measurement tools)

Numbers and verdict: `docs/benchmarks/2026-10-26-segments.md`. Not in `build.ts` / zero-cost / typecheck gates. Delete when
no longer needed.

- `ab.mjs` — interleaved in-process handler A/B over built apps (CPU µs / request, median of rounds).
- `http.mjs` + `srv.mjs` — HTTP lanes through the production node adapter, a fresh server process per lane and round;
  the server reports its own CPU (`process.cpuUsage`) and RSS high-water mark, so it runs on macOS and in Docker alike.
- `docker-http.sh` — `http.mjs` in the Node 26 image with gRPC data (`GRPC=<server.mjs>`).

Apps: any router build with a `/resume` page, e.g. lane NATIVE's `apps/ssr-bench/spikes/native/app` (`node app/build.ts
<outDir>`; in-memory data unless `GRPC_URL`), built once per runtime under test.

```sh
node apps/ssr-bench/spikes/segments/ab.mjs $PWD "/resume?rows=1000&token=t1" 600 11 base=<distA> new=<distB>
node apps/ssr-bench/spikes/segments/http.mjs $PWD 4 5 1 100,1000,5000 base=<distA> new=<distB>
```
