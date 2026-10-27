// rivet check setup handling: editor manifest missing/stale (T1), tsconfig errors, `-p` paths and
// solution references (T5), TypeScript line rules for line:col (T5).
import { test } from "vitest";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { manifestStatus } from "../index.ts";
import { repo, tempApp } from "./helpers.ts";

const cli = join(repo, "libs/language-core/cli.ts");
const base = (root: string, dir = root) => relative(dir, join(repo, "tsconfig.base.json"));
const tsconfig = (root: string, extra: Record<string, unknown> = {}) => JSON.stringify({ extends: base(root), include: ["src"], ...extra });
const run = (root: string, ...args: string[]) => spawnSync("node", [cli, ...args], { cwd: root, encoding: "utf8" });
const past = (root: string, path: string, seconds: number) => {
  const at = new Date(Date.now() - seconds * 1000);
  utimesSync(join(root, path), at, at);
};

test("rivet check: an app without .rivet/editor.json fails (RV7101); a stale one warns (RV7102)", () => {
  const root = tempApp({ "vite.config.ts": "export default {};\n", "src/routes/index.tsx": "export default () => <p>home</p>;\n" });
  try {
    writeFileSync(join(root, "tsconfig.json"), tsconfig(root));
    const missing = run(root);
    assert.equal(missing.status, 1, missing.stdout + missing.stderr);
    assert.match(missing.stdout, /^\.rivet\/editor\.json:1:1 - error RV7101: Editor manifest missing: .*`rivet sync`/m);
    assert.equal(run(root, "--no-manifest").status, 0);
    // Written after the config and routes: ok.
    mkdirSync(join(root, ".rivet"));
    writeFileSync(
      join(root, ".rivet/editor.json"),
      JSON.stringify({ version: 1, routesDir: "src/routes", routes: [{ id: "index", pattern: "/", file: "src/routes/index.tsx" }] }),
    );
    for (const path of ["vite.config.ts", "src/routes"]) past(root, path, 60);
    assert.deepEqual(manifestStatus(root), { status: "ok" });
    const clean = run(root);
    assert.equal(clean.status, 0, clean.stdout);
    assert.match(clean.stdout, /1 file, 0 errors, 0 warnings/);
    // A route added after it (routes directory mtime): stale, a warning only.
    past(root, ".rivet/editor.json", 30);
    writeFileSync(join(root, "src/routes/about.tsx"), "export default () => <p>about</p>;\n");
    assert.deepEqual(manifestStatus(root), { status: "stale", reason: "src/routes/" });
    const stale = run(root, "--format", "json");
    assert.equal(stale.status, 0, stale.stdout);
    const out = JSON.parse(stale.stdout);
    assert.equal(out.warnings, 1);
    assert.equal(out.diagnostics[0].code, "RV7102");
    assert.match(out.diagnostics[0].docs, /RV7102$/);
    // Editing the Vite config after it: stale too.
    past(root, "src/routes", 60);
    past(root, "src/routes/about.tsx", 60);
    assert.deepEqual(manifestStatus(root), { status: "ok" });
    writeFileSync(join(root, "vite.config.ts"), "export default { base: '/x/' };\n");
    assert.deepEqual(manifestStatus(root), { status: "stale", reason: "vite.config.ts" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rivet check: tsconfig errors exit 1 instead of skipping the project", () => {
  const root = tempApp({ "src/a.tsx": "export const A = () => <p />;\n" });
  try {
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ extends: "./missing-base.json", include: ["src"] }));
    const r = run(root);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /^rivet check: tsconfig\.json: .*missing-base\.json/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rivet check -p: directories resolve to their tsconfig.json; non-json files are rejected; references are followed", () => {
  const root = tempApp({ "app/src/a.tsx": "export function A() {\n  return <p>{...[]}</p>;\n}\n" });
  try {
    writeFileSync(
      join(root, "app/tsconfig.json"),
      JSON.stringify({ extends: base(root, join(root, "app")), include: ["src"], compilerOptions: { composite: true } }),
    );
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ files: [], references: [{ path: "./app" }] }));
    const dir = run(root, "-p", "app");
    assert.equal(dir.status, 1, dir.stdout + dir.stderr);
    assert.match(dir.stdout, /^app\/src\/a\.tsx:2:13 - error RV1002/m);
    const file = run(root, "-p", "app/src/a.tsx");
    assert.equal(file.status, 2);
    assert.match(file.stderr, /not a tsconfig/);
    // Solution config: the referenced project is checked, the empty solution itself not reported as skipped.
    const solution = run(root);
    assert.equal(solution.status, 1, solution.stdout + solution.stderr);
    assert.match(solution.stdout, /1 file, 1 error/);
    assert.doesNotMatch(solution.stdout, /skipped/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rivet check: line:col follow TypeScript's line breaks (CR-only, U+2028)", () => {
  const root = tempApp({ "src/a.tsx": "export function A() {\r  const x = 1;   return <p>{...[]}</p>;\r}\r" });
  try {
    writeFileSync(join(root, "tsconfig.json"), tsconfig(root));
    const r = run(root);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /^src\/a\.tsx:3:13 - error RV1002/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
