import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, test } from "vitest";
import { parseArgs, readStatus } from "../ai-tester/cli.ts";
const root = mkdtempSync(join(tmpdir(), "ai-tester-cli-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
test("CLI defaults to verified auto-commit and permits lower explicit budgets", () => {
  assert.deepEqual(parseArgs(["run", "--area", "reactivity"]), { command: "run", area: "reactivity", noCommit: false, wallMs: 1800000, rssLimitMB: 3072 });
  assert.deepEqual(parseArgs(["run", "--area", "router", "--no-commit", "--timeout", "2", "--rss-limit", "512"]), {
    command: "run",
    area: "router",
    noCommit: true,
    wallMs: 120000,
    rssLimitMB: 512,
  });
});
test("unknown flags, areas, duplicate inputs and raised/invalid budgets never start a campaign", () => {
  for (const args of [
    ["run"],
    ["run", "--area", "constructor"],
    ["run", "--area", "reactivity", "--area", "resume"],
    ["run", "--area", "reactivity", "--timeout", "31"],
    ["run", "--area", "reactivity", "--rss-limit", "3073"],
    ["run", "--area", "reactivity", "--timeout", "NaN"],
    ["run", "--area", "reactivity", "--root", "/tmp"],
    ["status", "../outside"],
    ["status", "one", "two"],
  ])
    assert.throws(() => parseArgs(args));
});
test("status reads durable terminal records and rejects traversal", () => {
  const dir = join(root, ".artifacts/ai-tester/example-run");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "run.json"), JSON.stringify({ id: "example-run", status: "failed", message: "worker exited 3" }));
  assert.equal(readStatus(root, "example-run")[0].status, "failed");
  assert.equal(readStatus(root).length, 1);
  assert.throws(() => readStatus(root, "../outside"));
});

test("doctor and campaigns accept only an explicit per-run model override", () => {
  assert.deepEqual(parseArgs(["doctor"]), { command: "doctor" });
  assert.deepEqual(parseArgs(["doctor", "--model", "gpt-6-astra"]), { command: "doctor", model: "gpt-6-astra" });
  assert.deepEqual(parseArgs(["run", "--area", "reactivity", "--model", "gpt-6-astra"]), {
    command: "run",
    area: "reactivity",
    model: "gpt-6-astra",
    noCommit: false,
    wallMs: 1800000,
    rssLimitMB: 3072,
  });
  for (const args of [
    ["doctor", "--model"],
    ["doctor", "--model", "x --sandbox danger-full-access"],
    ["doctor", "--model", "a", "--model", "b"],
    ["run", "--area", "reactivity", "--model", "a\nb"],
  ])
    assert.throws(() => parseArgs(args));
});
