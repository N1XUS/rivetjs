import { test } from "vitest";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { repo, tempApp } from "./helpers.ts";

const cli = join(repo, "libs/language-core/cli.ts");

const app = (counter: string) =>
  tempApp({
    "tsconfig.json": "",
    "src/counter.tsx": counter,
    ".rivet/editor.json": JSON.stringify({ version: 1, resumeModules: ["src/counter.tsx"] }),
  });

const write = (root: string) =>
  writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ extends: relative(root, join(repo, "tsconfig.base.json")), include: ["src"] }));

test("rivet check prints file:line:col diagnostics and fails on errors", () => {
  const root = app(`export function Counter() {\n  const w = window.innerWidth;\n  return <p>{...[]}{w}</p>;\n}\n`);
  try {
    write(root);
    const run = spawnSync("node", [cli, "-p", "tsconfig.json"], { cwd: root, encoding: "utf8" });
    assert.equal(run.status, 1, run.stderr);
    assert.match(run.stdout, /^src\/counter\.tsx:2:13 - error RV2001: Browser global `window`/m);
    assert.match(run.stdout, /^src\/counter\.tsx:3:13 - error RV1002: Spread children are not supported: /m);
    assert.match(run.stdout, /rivet check: 1 file, 2 errors, 0 warnings/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rivet check: warnings (RV2101) do not fail; --no-types skips them", () => {
  const root = app(
    `import { clientEffect } from "@rivetjs/runtime/dom";\nclass Store { #n = 1; }\ndeclare function make(): Store;\nexport function Counter() {\n  const store = make();\n  clientEffect(() => { void store; });\n  return <p>x</p>;\n}\n`,
  );
  try {
    write(root);
    const run = spawnSync("node", [cli], { cwd: root, encoding: "utf8" });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /src\/counter\.tsx:5:9 - warning RV2101: `store` is captured/);
    const untyped = spawnSync("node", [cli, "--no-types"], { cwd: root, encoding: "utf8" });
    assert.match(untyped.stdout, /1 file, 0 errors, 0 warnings/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rivet check --help exits 0; unknown arguments and bad --format exit 2", () => {
  const help = spawnSync("node", [cli, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /^usage: rivet-check \[-p tsconfig\.json\]\.\.\. \[--no-types\] \[--no-manifest\] \[--format text\|json\]/);
  assert.match(help.stdout, /Exit status: 0 no errors/);
  assert.equal(spawnSync("node", [cli, "--nope"], { encoding: "utf8" }).status, 2);
  const format = spawnSync("node", [cli, "--format", "xml"], { encoding: "utf8" });
  assert.equal(format.status, 2);
  assert.match(format.stderr, /--format must be text or json/);
});

test("rivet check --format json: diagnostics with codes, docs links and skipped projects", () => {
  const root = app(`export function Counter() {\n  return <p>{...[]}</p>;\n}\n`);
  try {
    write(root);
    writeFileSync(join(root, "plain.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx" }, files: [] }));
    const run = spawnSync("node", [cli, "-p", "tsconfig.json", "-p", "plain.json", "--format=json"], { cwd: root, encoding: "utf8" });
    assert.equal(run.status, 1, run.stderr);
    const out = JSON.parse(run.stdout);
    assert.equal(out.files, 1);
    assert.equal(out.errors, 1);
    assert.equal(out.warnings, 0);
    assert.deepEqual(out.skipped, [{ config: "plain.json", reason: 'jsxImportSource is null, not "@rivetjs/runtime"' }]);
    const [d] = out.diagnostics;
    assert.equal(d.code, "RV1002");
    assert.equal(d.file, "src/counter.tsx");
    assert.match(d.docs, /^https:\/\/.+\/RV1002$/);
    // Text output notes skipped projects.
    const text = spawnSync("node", [cli, "-p", "tsconfig.json", "-p", "plain.json"], { cwd: root, encoding: "utf8" });
    assert.match(text.stdout, /^rivet check: skipped plain\.json \(jsxImportSource is null, not "@rivetjs\/runtime"\)$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rivet check: an unreadable tsconfig is a setup error (exit 2)", () => {
  const root = app(`export const A = () => <p />;\n`);
  try {
    writeFileSync(join(root, "tsconfig.json"), "{ not json");
    const run = spawnSync("node", [cli, "-p", "missing.json"], { cwd: root, encoding: "utf8" });
    assert.equal(run.status, 2, run.stdout + run.stderr);
    assert.match(run.stderr, /^rivet check: missing\.json: /);
    const json = spawnSync("node", [cli, "-p", "missing.json", "--format", "json"], { cwd: root, encoding: "utf8" });
    assert.equal(json.status, 2);
    assert.match(JSON.parse(json.stdout).error, /missing\.json/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
