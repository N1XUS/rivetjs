// The router lane end to end: `dist/rivet-router.mjs` (production @rivetjs/router node adapter over the
// file-routed build, derived resume model) against an in-process gRPC Content service, checked with the bench's validator.
import { afterAll, beforeAll, test } from "vitest";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { Window } from "happy-dom";
import { fieldText, validateResponse } from "../loadgen/validate.ts";

const HOSTILE = '"><script>alert(1)</script>';
let server: grpc.Server, child: ChildProcess, base: string;

async function serve(bundle: string, port: number): Promise<[ChildProcess, string]> {
  const spawned = spawn(process.execPath, [fileURLToPath(new URL(`../dist/${bundle}`, import.meta.url))], {
    env: { ...process.env, GRPC_URL: `127.0.0.1:${port}`, PORT: "0" },
    stdio: ["ignore", "pipe", "inherit"],
  });
  const [line] = (await once(spawned.stdout!, "data")) as [Buffer];
  const listening = /listening on http:\/\/[^:]+:(\d+)/.exec(line.toString());
  assert.ok(listening, line.toString());
  return [spawned, `http://127.0.0.1:${listening[1]}`];
}

beforeAll(async () => {
  const definition = protoLoader.loadSync(fileURLToPath(new URL("../proto/content.proto", import.meta.url)), { defaults: true, arrays: true });
  const content = (grpc.loadPackageDefinition(definition) as unknown as { rivet: { bench: { Content: { service: grpc.ServiceDefinition } } } }).rivet.bench
    .Content;
  server = new grpc.Server();
  server.addService(content.service, {
    GetPage(call: grpc.ServerUnaryCall<{ rows: number; token: string; strings: number }, unknown>, done: grpc.sendUnaryData<unknown>) {
      const { rows, token, strings } = call.request;
      const fields = (id: number) => Array.from({ length: 10 }, (_, field) => id * 100 + field);
      done(null, {
        token,
        title: "A < B & C",
        markdown: "",
        rows: Array.from({ length: rows }, (_, id) =>
          strings ? { id, values: [], textValues: fields(id).map((_, field) => fieldText(id, field, strings)) } : { id, values: fields(id) },
        ),
      });
    },
  });
  const port = await new Promise<number>((resolve, reject) =>
    server.bindAsync("127.0.0.1:0", grpc.ServerCredentials.createInsecure(), (error, bound) => (error ? reject(error) : resolve(bound))),
  );
  [child, base] = await serve("rivet-router.mjs", port);
}, 30_000);

afterAll(async () => {
  for (const spawned of [child]) {
    spawned?.kill("SIGTERM");
    if (spawned && spawned.exitCode === null) await once(spawned, "exit");
  }
  server?.forceShutdown();
});

test("rivet-router serves complete validated pages through file routes", async () => {
  for (const rows of [0, 3, 100]) {
    const response = await fetch(`${base}/page?rows=${rows}&token=trial-1`);
    const body = Buffer.from(await response.arrayBuffer());
    assert.ok(validateResponse(response.status, body, rows, "trial-1"), `rows=${rows}`);
    assert.match(response.headers.get("content-security-policy") ?? "", /script-src 'nonce-/);
  }
});

test("rivet-router and rivet-resume serve the escaping variant with exact parsed field text", async () => {
  for (const path of ["/page", "/resume"]) {
    const response = await fetch(`${base}${path}?rows=20&token=trial-2&strings=1`);
    const body = Buffer.from(await response.arrayBuffer());
    assert.ok(validateResponse(response.status, body, 20, "trial-2", false, true), path);
    assert.equal(validateResponse(response.status, body, 20, "trial-2"), false, `${path}: integer expectations must not match`);
    assert.ok(!body.toString().includes("<b>"), `${path}: field markup is escaped`);
  }
});

test("rivet-resume renders a resumable page: For rows, handlers, links, nested layout, state", async () => {
  const response = await fetch(`${base}/resume?rows=50&token=trial-3`);
  const html = await response.text();
  assert.ok(validateResponse(response.status, Buffer.from(html), 50, "trial-3"));
  assert.match(html, /data-layout="resume"/);
  assert.equal((html.match(/<a\b[^>]*href="\/resume\?rows=\d+"/g) ?? []).length, 51, "row links + layout link");
  assert.match(html, /data-rt="/, "derived loader names the runtime chunk");
  assert.doesNotMatch(html, /rivet\/state/, "no serialized state table");
  const plain = await (await fetch(`${base}/page?rows=50&token=trial-3`)).text();
  assert.ok(html.length > plain.length, "resumable output carries more than the static page");
});

test("rivet-router preserves the hostile token attribute and escapes the title", async () => {
  const response = await fetch(`${base}/page?rows=1&token=${encodeURIComponent(HOSTILE)}`);
  const html = await response.text();
  const window = new Window();
  const template = window.document.createElement("template");
  template.innerHTML = html;
  const document = template.content;
  assert.equal(document.querySelector("main")?.getAttribute("data-token"), HOSTILE);
  assert.equal(document.querySelector("title")?.textContent, "A < B & C");
  assert.equal(document.querySelector("[data-lane]")?.getAttribute("data-lane"), "rivet-router");
  assert.ok([...document.querySelectorAll("script")].every((script) => script.textContent !== "alert(1)"));
  await window.happyDOM.close();
});

test("rivet-router rejects out-of-contract requests and answers the bench control endpoints", async () => {
  for (const query of ["rows=-1", "rows=5001", "rows=1.5", "delay_ms=6000", "token=" + "x".repeat(513), "article=1"])
    assert.equal((await fetch(`${base}/page?${query}`)).status, 400, query);
  const health = (await (await fetch(`${base}/health`)).json()) as { status: string; framework: string };
  assert.deepEqual([health.status, health.framework], ["ready", "rivet-router"]);
  assert.equal(typeof ((await (await fetch(`${base}/metrics`)).json()) as { rss: number }).rss, "number");
});
