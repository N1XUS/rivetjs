// cpu-breakdown.ts: self-time attribution of a --cpu-prof profile to Rivet-owned vs shared bench code.
import { test } from "vitest";
import assert from "node:assert/strict";
import { breakdown, owner } from "../cpu-breakdown.ts";

const frame = (functionName: string, url = "") => ({ functionName, url, lineNumber: 0 });

test("frames are attributed to their owner", () => {
  assert.equal(owner(frame("(garbage collector)")), "gc");
  assert.equal(owner(frame("(idle)")), "idle");
  assert.equal(owner(frame("deserialize", "file:///workspace/node_modules/@grpc/grpc-js/build/src/call.js")), "data");
  assert.equal(owner(frame("decodePage", "file:///workspace/apps/ssr-bench/dist/server.mjs")), "data");
  assert.equal(owner(frame("grpcEnd", "file:///workspace/apps/ssr-bench/dist/server.mjs")), "data");
  assert.equal(owner(frame("row", "file:///workspace/apps/ssr-bench/dist/rivet-router/server/entry.js")), "data");
  assert.equal(owner(frame("handle", "file:///workspace/apps/ssr-bench/dist/server.mjs")), "harness");
  assert.equal(owner(frame("renderPage", "file:///workspace/apps/ssr-bench/dist/rivet-compiled.mjs")), "rivet");
  assert.equal(owner(frame("handler", "file:///workspace/apps/ssr-bench/dist/rivet-router/server/entry.js")), "rivet");
  assert.equal(owner(frame("Writable.write", "node:internal/streams/writable")), "http");
  assert.equal(owner(frame("writeUtf8String")), "http");
  assert.equal(owner(frame("renderPage", "file:///workspace/apps/ssr-bench/dist/solid.mjs")), "other");
});

test("breakdown sums self time per owner and excludes idle from busy", () => {
  const nodes = [
    { id: 1, callFrame: frame("(root)") },
    { id: 2, callFrame: frame("(idle)") },
    { id: 3, callFrame: frame("renderPage", "file:///w/dist/rivet-compiled.mjs") },
    { id: 4, callFrame: frame("(garbage collector)") },
  ];
  const { owners, busy, functions } = breakdown({ nodes, startTime: 0, endTime: 100, samples: [2, 3, 3, 4], timeDeltas: [50, 20, 20, 10] });
  assert.equal(owners.idle, 50);
  assert.equal(owners.rivet, 40);
  assert.equal(owners.gc, 10);
  assert.equal(busy, 50);
  assert.equal(functions[0]![0].startsWith("(idle)"), true);
});
