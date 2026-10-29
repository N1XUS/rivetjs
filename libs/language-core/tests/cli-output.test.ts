import { expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { rmSync } from "node:fs";
import { tempApp } from "./helpers.ts";
const cli = resolve("libs/language-core/cli.ts");
const run = (...args: string[]) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", env: { ...process.env, FORCE_COLOR: undefined, NO_COLOR: "1" } });
test("missing option values and misspelled flags return JSON usage failures", () => {
  for (const args of [["-p"], ["--project", "--no-types"], ["--formt", "json"]]) {
    const result = run(...args, "--json");
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout).exitCode).toBe(2);
    expect(result.stderr).toBe("");
  }
  expect(run("--formt", "json").stderr).toContain("Did you mean --format?");
});
test("quiet warnings do not fail, JSON keeps counts and grouped warning locations", () => {
  const root = tempApp({
    "tsconfig.json": JSON.stringify({ compilerOptions: { jsxImportSource: "@rivetjs/runtime", jsx: "preserve" }, include: ["src"] }),
    "src/counter.tsx":
      'import { signal } from "@rivetjs/reactivity"; export function Counter(p: {list: number[]}) { const all = []; for (const n of p.list) { all.push(signal(n)); all.push(signal(n)); } return <p onClick={() => all[0]?.set(1)} />; }',
    ".rivet/editor.json": JSON.stringify({ version: 1, resumeModules: ["src/counter.tsx"] }),
  });
  try {
    const args = ["-p", join(root, "tsconfig.json"), "--no-manifest"];
    const result = run(...args, "--json");
    expect(result.status).toBe(0);
    const body = JSON.parse(result.stdout);
    expect(body.warnings).toBe(2);
    expect(body.diagnostics).toHaveLength(1);
    expect(body.diagnostics[0].count).toBe(2);
    expect(body.diagnostics[0].occurrences).toHaveLength(2);
    const quiet = run(...args, "--quiet");
    expect(quiet.status).toBe(0);
    expect(quiet.stdout).toBe("");
    expect(quiet.stderr).toBe("");
    const jsonQuiet = JSON.parse(run(...args, "--json", "--quiet").stdout);
    expect(jsonQuiet.warnings).toBe(2);
    expect(jsonQuiet.diagnostics).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
