import { expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { terminalError } from "../build/dev-errors.ts";
import { prerender } from "../adapters/static.ts";

const cli = resolve("libs/router/cli/rivet.ts");
const run = (...args: string[]) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", env: { ...process.env, FORCE_COLOR: undefined, NO_COLOR: "1", DEBUG: "" } });
test("rivet usage errors suggest a correction and keep JSON parseable", () => {
  const unknown = run("syn");
  expect(unknown.status).toBe(2);
  expect(unknown.stderr).toContain("Did you mean sync?");
  expect(unknown.stderr).not.toContain("at main");
  for (const args of [
    ["sync", "--root"],
    ["sync", "--root", "--mode"],
    ["sync", "--rot", "x"],
  ]) {
    const result = run(...args, "--json");
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout).exitCode).toBe(2);
    expect(result.stderr).toBe("");
  }
  expect(run("sync", "--help").status).toBe(0);
});
test("config exceptions have a remedy, exit 1 and no stack unless verbose", () => {
  mkdirSync(".artifacts", { recursive: true });
  const root = mkdtempSync(resolve(".artifacts/cli-output-"));
  try {
    writeFileSync(join(root, "vite.config.ts"), 'throw new Error("Bad configuration"); export default {};');
    const result = run("sync", "--root", root, "--json");
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ error: "Bad configuration", exitCode: 1 });
    expect(JSON.parse(result.stdout).stack).toBeUndefined();
    expect(result.stderr).toBe("");
    expect(JSON.parse(run("sync", "--root", root, "--json", "--verbose").stdout).stack).toContain("Error: Bad configuration");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("dev terminal reports mapped app location and code frame; overlay stack remains separate", () => {
  const message = terminalError(
    Object.assign(new Error("Broken loader"), { stack: `Error: Broken loader\n    at load (${resolve("libs/router/tests/cli-output.test.ts")}:1:1)` }),
    process.cwd(),
    "load failed",
  );
  expect(message).toContain("error: [rivet:router]");
  expect(message).toContain("libs/router/tests/cli-output.test.ts:1:1");
  expect(message).toContain("> 1 |");
  expect(message).toContain("fix:");
  expect(message).not.toContain("at load (");
});
test("prerender can suppress progress and reports actionable failing routes", async () => {
  await expect(
    prerender({
      progress: false,
      outDir: ".artifacts/unused-cli-output",
      routes: [{ id: "home", pattern: "/", page: true, layouts: [] }],
      handler: async () => new Response("failure", { status: 500 }),
    }),
  ).rejects.toThrow("Prerender / (home) returned 500. Fix the route loader/render error");
});
