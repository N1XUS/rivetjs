// The shared lean node:http2 gRPC client (`services/content.server.ts`) against a real grpc-js server:
// requests decode like protobufjs's, responses decode like proto-loader's, statuses / aborts / reconnects reject cleanly.
import { afterAll, beforeAll, test } from "vitest";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { contentServer, encodePageRequest, GrpcError, type PageRequest } from "../services/content.server.ts";

const definition = protoLoader.loadSync(fileURLToPath(new URL("../proto/content.proto", import.meta.url)), { defaults: true, arrays: true });
const method = (definition["rivet.bench.Content"] as protoLoader.ServiceDefinition).GetPage!;
let server: grpc.Server, address: string;
const seen: Record<string, unknown>[] = [];

async function listen(port = 0): Promise<number> {
  server = new grpc.Server();
  const content = (grpc.loadPackageDefinition(definition) as unknown as { rivet: { bench: { Content: { service: grpc.ServiceDefinition } } } }).rivet.bench
    .Content;
  server.addService(content.service, {
    GetPage(call: grpc.ServerUnaryCall<PageRequest & { strings: number }, unknown>, done: grpc.sendUnaryData<unknown>) {
      const { rows, token, delayMs, strings } = call.request;
      seen.push({ ...call.request, deadline: call.getDeadline() });
      if (token === "fail") return done({ code: grpc.status.NOT_FOUND, details: "no page ü" });
      const reply = () =>
        done(null, {
          token,
          title: "A < B & C",
          markdown: "",
          rows: Array.from({ length: rows }, (_, id) =>
            strings ? { id, values: [], textValues: [`t${id} <&>`, "ü😀"] } : { id, values: Array.from({ length: 10 }, (_, f) => id * 100 + f - 5) },
          ),
        });
      if (delayMs) setTimeout(reply, delayMs);
      else reply();
    },
  });
  return new Promise<number>((resolve, reject) =>
    server.bindAsync(`127.0.0.1:${port}`, grpc.ServerCredentials.createInsecure(), (error, bound) => (error ? reject(error) : resolve(bound))),
  );
}

beforeAll(async () => {
  address = `127.0.0.1:${await listen()}`;
});
afterAll(() => server?.forceShutdown());

test("request framing decodes like protobufjs's (proto3 defaults omitted, UTF-8 token, negative int32)", () => {
  for (const request of [
    { rows: 0, token: "", article: false, delayMs: 0 },
    { rows: 1000, token: "tok", article: false, delayMs: 0, strings: 2 },
    { rows: 5000, token: '"><script>ü😀', article: true, delayMs: 300, strings: 1 },
    { rows: -1, token: "x".repeat(512), article: false, delayMs: 127, strings: 0 },
  ]) {
    const frame = encodePageRequest(request);
    assert.equal(frame[0], 0);
    assert.equal(frame.readUInt32BE(1), frame.length - 5);
    // protobufjs also writes zero-valued fields; the decoded request is the same.
    assert.deepEqual(method.requestDeserialize(frame.subarray(5)), method.requestDeserialize(method.requestSerialize(request)));
  }
});

test("fetches and decodes pages like proto-loader through a grpc-js server", async () => {
  const service = contentServer(address);
  try {
    const page = await service.getPage({ rows: 3, token: "trial-1", article: false, delayMs: 0 });
    assert.deepEqual(page, {
      token: "trial-1",
      title: "A < B & C",
      markdown: "",
      rows: [0, 1, 2].map((id) => ({ id, values: Array.from({ length: 10 }, (_, f) => id * 100 + f - 5) })),
    });
    const text = await service.getPage({ rows: 2, token: "t", article: false, delayMs: 0, strings: 1 });
    assert.deepEqual(text.rows[1], { id: 1, values: ["t1 <&>", "ü😀"] });
    // Concurrent calls share one session; large responses span many DATA frames.
    const pages = await Promise.all(Array.from({ length: 20 }, (_, i) => service.getPage({ rows: 1000 + i, token: `c${i}`, article: false, delayMs: 0 })));
    pages.forEach((p, i) => (assert.equal(p.rows.length, 1000 + i), assert.equal(p.token, `c${i}`)));
    // grpc-timeout 15 s, like the former grpc-js deadline.
    const deadline = Number(seen.at(-1)!.deadline) - Date.now();
    assert.ok(deadline > 13000 && deadline <= 15000, String(deadline));
  } finally {
    service.close();
  }
});

test("non-OK statuses, aborts and closed channels reject; the session reconnects after the server restarts", async () => {
  const service = contentServer(address);
  try {
    await assert.rejects(service.getPage({ rows: 1, token: "fail", article: false, delayMs: 0 }), (error: GrpcError) => {
      assert.equal(error.code, grpc.status.NOT_FOUND);
      assert.equal(error.details, "no page ü");
      return true;
    });
    const controller = new AbortController();
    const pending = service.getPage({ rows: 1, token: "slow", article: false, delayMs: 500 }, { signal: controller.signal });
    setTimeout(() => controller.abort(new Error("client went away")), 20);
    await assert.rejects(pending, /client went away/);
    await assert.rejects(service.getPage({ rows: 1, token: "x", article: false, delayMs: 0 }, { signal: AbortSignal.abort(new Error("pre")) }), /pre/);
    // Still usable after an abort.
    assert.equal((await service.getPage({ rows: 1, token: "after", article: false, delayMs: 0 })).token, "after");

    const port = Number(address.split(":")[1]);
    server.forceShutdown();
    await assert.rejects(service.getPage({ rows: 1, token: "down", article: false, delayMs: 0 }));
    await listen(port);
    assert.equal((await service.getPage({ rows: 2, token: "back", article: false, delayMs: 0 })).rows.length, 2);
  } finally {
    service.close();
  }
  await assert.rejects(service.getPage({ rows: 1, token: "closed", article: false, delayMs: 0 }), (error: GrpcError) => error.code === 14);
});
