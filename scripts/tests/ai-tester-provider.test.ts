import assert from "node:assert/strict";
import { test } from "vitest";
import { codex } from "../ai-tester/agent.ts";

test("Codex driver scopes model and integrations to the child without changing inherited defaults", () => {
  const context = { role: "worker" as const, workspace: "/tmp/work", output: "/tmp/out", schema: "/tmp/schema", prompt: "test" };
  const command = codex({ ...context, model: "gpt-6-astra", mcpServers: ["nx-mcp", "chrome-devtools"] });
  assert.equal(command.args[command.args.indexOf("--model") + 1], "gpt-6-astra");
  assert.ok(command.args.includes("mcp_servers.nx-mcp.enabled=false"));
  assert.ok(command.args.includes("mcp_servers.chrome-devtools.enabled=false"));
  for (const feature of ["apps", "plugins", "multi_agent"]) assert.ok(command.args.some((arg, i) => arg === "--disable" && command.args[i + 1] === feature));
  assert.ok(command.args.includes("--ephemeral"));
  assert.equal(codex({ ...context, role: "reviewer", mcpServers: [] }).args.includes("--model"), false);
  assert.throws(() => codex({ ...context, mcpServers: ["untrusted.key"] }));
});

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";
import { runDoctor, inspectCodex, providerFailure } from "../ai-tester/provider.ts";
import type { Agent } from "../ai-tester/types.ts";
const scratch = mkdtempSync(join(tmpdir(), "rivet-provider-test-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const scripted = join(scratch, "probe.mjs");
writeFileSync(
  scripted,
  `import{writeFileSync}from'node:fs';const[out,mode]=process.argv.slice(2);if(mode==='unsupported'){console.log(JSON.stringify({type:'error',message:'model_not_found: model is not supported'}));process.exit(1)}if(mode==='hang')await new Promise(()=>setInterval(()=>{},1000));writeFileSync(out,JSON.stringify(mode==='bad-result'?{ready:true,certified:true}:{ready:true}));if(mode!=='no-completion')console.log(JSON.stringify({type:'turn.completed'}));`,
);
const capabilities = { version: "codex-cli fixture", mcpServers: ["external-service"] };
function agent(mode = "ready"): Agent {
  return (context) => {
    assert.equal(context.role, "reviewer");
    assert.equal(context.model, "gpt-6-astra");
    assert.deepEqual(context.mcpServers, capabilities.mcpServers);
    return { file: process.execPath, args: [scripted, context.output, mode] };
  };
}
test("doctor requires completed structured inference and records only scoped metadata", async () => {
  const result = await runDoctor({ root: scratch, model: "gpt-6-astra", agent: agent(), capabilities });
  assert.equal(result.status, "ready");
  assert.equal(result.model, "gpt-6-astra");
  assert.equal(result.cliVersion, capabilities.version);
  const persisted = JSON.parse(readFileSync(join(scratch, ".artifacts/ai-tester/diagnostics", result.id, "doctor.json"), "utf8"));
  assert.equal(persisted.status, "ready");
  assert.equal(persisted.execution.code, 0);
  assert.ok(Number.isFinite(persisted.execution.peakRssBytes) && persisted.execution.peakRssBytes >= 0);
});
for (const mode of ["unsupported", "bad-result", "no-completion"])
  test(`doctor fails closed for ${mode}`, async () => {
    const result = await runDoctor({ root: scratch, model: "gpt-6-astra", agent: agent(mode), capabilities });
    assert.equal(result.status, "failed");
    assert.equal(result.failure?.kind, mode === "unsupported" ? "unsupported-model" : "invalid-result");
  });
test("doctor timeout cannot produce readiness", async () => {
  const result = await runDoctor({ root: scratch, model: "gpt-6-astra", agent: agent("hang"), capabilities, wallMs: 40 });
  assert.equal(result.status, "failed");
  assert.equal(result.failure?.kind, "timeout");
});
test("CLI inspection keeps credential-bearing MCP configuration out of returned metadata/errors", () => {
  const bin = join(scratch, "bin");
  mkdirSync(bin);
  const fake = join(bin, "codex");
  writeFileSync(
    fake,
    `#!/usr/bin/env node\nif(process.argv.includes('--version'))console.log('codex-cli 0.fixture');else console.log(JSON.stringify([{name:'external-service',enabled:!process.argv.some(arg=>arg.endsWith('.enabled=false')),transport:{env:{TOKEN:'DO_NOT_LOG_TOKEN'}}}]));`,
  );
  chmodSync(fake, 0o755);
  const previous = process.env.PATH;
  process.env.PATH = bin + ":" + previous;
  try {
    const metadata = inspectCodex(scratch);
    assert.deepEqual(metadata, { version: "codex-cli 0.fixture", mcpServers: ["external-service"] });
    assert.doesNotMatch(JSON.stringify(metadata), /DO_NOT_LOG_TOKEN/);
    writeFileSync(
      fake,
      `#!/usr/bin/env node\nif(process.argv.includes('--version'))console.log('codex-cli fixture');else console.log('DO_NOT_LOG_TOKEN invalid JSON');`,
    );
    assert.throws(
      () => inspectCodex(scratch),
      (error: Error) => !error.message.includes("DO_NOT_LOG_TOKEN"),
    );
  } finally {
    process.env.PATH = previous;
  }
});
test("provider failures distinguish account/model/network/resource faults without echoing raw response bodies", () => {
  for (const [text, kind] of [
    ["model_not_found secret", "unsupported-model"],
    ["HTTP 401 secret", "authentication"],
    ["HTTP 429 secret", "rate-limit"],
    ["ECONNREFUSED secret", "network"],
  ]) {
    const value = providerFailure(text, null);
    assert.equal(value.kind, kind);
    assert.doesNotMatch(value.message, /secret/);
  }
});
