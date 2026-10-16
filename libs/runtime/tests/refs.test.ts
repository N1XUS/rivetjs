// Element refs (`ref<T>()`) on both targets: TSX suites in ./refs/ through the testing register hook.
import { test } from "vitest";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const register = fileURLToPath(import.meta.resolve("@rivetjs/runtime/testing/register"));
const dir = fileURLToPath(new URL("./refs/", import.meta.url));
const conditions = process.execArgv.filter((arg) => arg.startsWith("--conditions"));
const { NODE_TEST_CONTEXT: _, ...env } = process.env;

test("refs: object refs, forwarding, callback refs, Show and For rows (DOM); no-op on the server", () => {
  const run = spawnSync(process.execPath, [...conditions, "--import", register, "--test", "--test-reporter=tap", dir + "dom.test.tsx", dir + "refs.server.test.tsx"], { encoding: "utf8", env });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /^# pass 6$/m);
});
