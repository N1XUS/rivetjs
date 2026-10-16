import { test } from "vitest";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const register = fileURLToPath(import.meta.resolve("@rivetjs/runtime/testing/register"));
const dir = fileURLToPath(new URL("./testing/", import.meta.url));
// Same resolution as this run (production, or the `development` condition pass).
const conditions = process.execArgv.filter((arg) => arg.startsWith("--conditions"));
// Without NODE_TEST_CONTEXT, a nested `node --test` reports to its own stdout instead of this runner.
const { NODE_TEST_CONTEXT: _, ...env } = process.env;
const node = (args: string[], extra: NodeJS.ProcessEnv = {}) =>
  spawnSync(process.execPath, [...conditions, "--import", register, ...args], {
    encoding: "utf8",
    env: { ...env, ...extra },
  });

test("register hook runs TSX component suites under node --test (DOM default, *.server.test.tsx on the server)", () => {
  const run = node(["--test", "--test-reporter=tap", join(dir, "dom.test.tsx"), join(dir, "render.server.test.tsx")]);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /^# pass 12$/m);
  assert.match(run.stdout, /^# fail 0$/m);
});

test("register hook carries the server target through relative .ts imports (barrels), not package specifiers", () => {
  const run = node(["--test", "--test-reporter=tap", join(dir, "barrel.server.test.tsx")]);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /^# pass 2$/m);
  assert.match(run.stdout, /^# fail 0$/m);
});

test("register hook reports compiler diagnostics with the file name", () => {
  const tmp = mkdtempSync(join(tmpdir(), "rivet-testing-"));
  try {
    const file = join(tmp, "broken.tsx");
    writeFileSync(file, "export const view = <div></span>;\n");
    const run = node([file]);
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /Rivet compile failed/);
    assert.ok(run.stderr.includes(file), run.stderr);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("RIVET_TEST_TARGET=server compiles every module of the process for the server", () => {
  const file = join(dir, "env-target.tsx");
  const server = node([file], { RIVET_TEST_TARGET: "server" });
  assert.equal(server.status, 0, server.stderr);
  assert.equal(server.stdout, "<p>2</p>\n");
  const dom = node([file]);
  assert.notEqual(dom.status, 0);
  assert.match(dom.stderr, /inside mount/);
});
