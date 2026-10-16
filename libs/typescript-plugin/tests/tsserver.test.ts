// End to end: tsserver's own plugin loading (`globalPlugins` + probe location) requires the CommonJS
// bundle, the plugin answers diagnostics and the `_rivet:*` protocol requests in a real Session.
import { test, afterAll as after, beforeAll as before } from "vitest";
import assert from "node:assert/strict";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { buildPlugin } from "../build.ts";
import { fixture, repo, type Fixture } from "./fixture.ts";

let fx: Fixture;
let session: ts.server.Session;
let seq = 0;
const logs: string[] = [];

const request = <T>(command: string, args: object): T => {
  const response = session.executeCommand({ seq: ++seq, type: "request", command, arguments: args } as ts.server.protocol.Request);
  return response.response as T;
};

before(async () => {
  await buildPlugin();
  fx = fixture();
  // Route types from `vite dev` (Q5): only in .rivet/, not in the tsconfig include.
  writeFileSync(join(fx.root, ".rivet/routes.d.ts"), `declare module "@rivetjs/router" { interface RouteParams { "items/[id]": { id: string } } }\nexport {};\n`);
  writeFileSync(join(fx.root, "src/params.ts"), `import type { RouteParams } from "@rivetjs/router";\nexport const id: RouteParams["items/[id]"]["id"] = "1";\n`);
  const noop = () => ({ close() {} });
  const host: ts.server.ServerHost = { ...ts.sys, setTimeout, clearTimeout, setImmediate, clearImmediate, watchFile: noop, watchDirectory: noop } as ts.server.ServerHost;
  const logger = {
    close() {},
    hasLevel: () => true,
    loggingEnabled: () => true,
    perftrc() {},
    info: (s: string) => void logs.push(s),
    startGroup() {},
    endGroup() {},
    msg: (s: string) => void logs.push(s),
    getLogFileName: () => undefined,
  } as unknown as ts.server.Logger;
  session = new ts.server.Session({
    host,
    cancellationToken: ts.server.nullCancellationToken,
    useSingleInferredProject: false,
    useInferredProjectPerProjectRoot: false,
    typingsInstaller: ts.server.nullTypingsInstaller,
    byteLength: Buffer.byteLength,
    hrtime: process.hrtime,
    logger,
    canUseEvents: false,
    globalPlugins: ["@rivetjs/typescript-plugin"],
    pluginProbeLocations: [repo],
    allowLocalPluginLoads: false,
  });
});

after(() => {
  session?.exit?.();
  if (fx) rmSync(fx.root, { recursive: true, force: true });
});

test("tsserver loads the bundled plugin and reports compiler diagnostics", () => {
  const file = fx.file("src/broken.tsx");
  request("open", { file });
  const diagnostics = request<ts.server.protocol.Diagnostic[]>("semanticDiagnosticsSync", { file });
  const ours = diagnostics.filter((d) => d.source === "rivet");
  assert.deepEqual(ours.map((d) => d.code).sort(), [71002, 71008], logs.filter((l) => /plugin|rivet/i.test(l)).join("\n"));
  assert.ok(logs.some((l) => /rivet: compiler .*rivet_compiler\.wasm/.test(l)));
});

test("_rivet:sites and _rivet:doctor answer for an open file", () => {
  const file = fx.file("src/counter.tsx");
  request("open", { file });
  const sites = request<{ resume: boolean; sites: { kind: string; id: string; label: string }[] }>("_rivet:sites", { file });
  assert.equal(sites.resume, true);
  assert.ok(sites.sites.some((s) => s.kind === "event" && s.id.startsWith("src/counter.tsx#Counter$")));
  // Inlay hint text for the VS Code extension's native provider.
  assert.ok(sites.sites.some((s) => s.kind === "event" && s.label === "client · count, step"), JSON.stringify(sites.sites.map((s) => s.label)));
  const { findings } = request<{ findings: { id: string }[] }>("_rivet:doctor", { file });
  // Route types were not generated in this fixture's .rivet/ by vite, but routes.d.ts exists: clean.
  assert.deepEqual(findings.map((f) => f.id), []);
});

test("generated .rivet/routes.d.ts joins the project (getExternalFiles)", () => {
  const file = fx.file("src/params.ts");
  request("open", { file });
  const diagnostics = request<ts.server.protocol.Diagnostic[]>("semanticDiagnosticsSync", { file });
  assert.deepEqual(diagnostics.map((d) => d.text), []);
});
