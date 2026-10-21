// Runs the Suspense / transition TSX suites (DOM through happy-dom, server target) under the register hook.
import { test } from "vitest";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const register = fileURLToPath(import.meta.resolve("@rivetjs/runtime/testing/register"));
const dir = fileURLToPath(new URL("./suspense/", import.meta.url));
const conditions = process.execArgv.filter((arg) => arg.startsWith("--conditions"));
const { NODE_TEST_CONTEXT: _, ...env } = process.env;

test("Suspense and transitions: DOM and server suites", () => {
  const run = spawnSync(process.execPath, [...conditions, "--import", register, "--test", "--test-reporter=tap", dir + "dom.test.tsx", dir + "server.server.test.tsx"], { encoding: "utf8", env });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /^# fail 0$/m);
  assert.match(run.stdout, /^# pass 13$/m);
});
