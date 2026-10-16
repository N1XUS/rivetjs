// T3: compiler per wasm (not fixed by the first project, failures retried), configuration changes
// applied + diagnostics refreshed, `.rivet` route types found at the Vite root, bounded check cache.
import { test } from "vitest";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { CHECK_CACHE_SIZE, createLanguageCore, workspaceCompilerWasm } from "@rivetjs/language-core";
import { fixture, repo } from "./fixture.ts";

const rivet = (diagnostics: readonly ts.Diagnostic[]) => diagnostics.filter((d) => d.source === "rivet").map((d) => d.code);

test("a missing compiler is not cached forever: the wasm appearing later is picked up", () => {
  const outside = mkdtempSync(join(tmpdir(), "rivet-plugin-wasm-"));
  const wasm = join(outside, "rivet_compiler.wasm");
  // Project directory outside the workspace: no workspace compiler, only `compilerWasm`.
  const fx = fixture({ compilerWasm: wasm }, { getCurrentDirectory: () => outside });
  try {
    assert.deepEqual(rivet(fx.service.getSemanticDiagnostics(fx.file("src/broken.tsx"))), []);
    copyFileSync(workspaceCompilerWasm(repo)!, wasm);
    assert.deepEqual(rivet(fx.service.getSemanticDiagnostics(fx.file("src/broken.tsx"))).sort(), [71002, 71008]);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("onConfigurationChanged applies editor settings and refreshes open projects' diagnostics", () => {
  let refreshed = 0;
  const fx = fixture(undefined, {
    refreshDiagnostics() {
      refreshed++;
    },
  });
  try {
    const file = fx.file("src/counter.tsx");
    const span = { start: 0, length: 10_000 };
    const hints = () => fx.service.provideInlayHints(file, span, {}).filter((h) => /client/.test(String(h.text)));
    assert.ok(hints().length > 0);
    fx.plugin.onConfigurationChanged!({ inlayHints: false });
    assert.equal(refreshed, 1);
    assert.deepEqual(hints(), []);
    fx.plugin.onConfigurationChanged!({ inlayHints: "all" });
    assert.equal(refreshed, 2);
    assert.ok(hints().length > 0);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test("getExternalFiles: route types of the Vite root the project's files live in, not only next to tsconfig", () => {
  const fx = fixture();
  try {
    const app = join(fx.root, "apps/web");
    mkdirSync(join(app, ".rivet"), { recursive: true });
    mkdirSync(join(app, "src"), { recursive: true });
    writeFileSync(join(app, "vite.config.ts"), "export default {};\n");
    writeFileSync(join(app, "src/page.tsx"), "export const Page = () => <p />;\n");
    writeFileSync(join(app, ".rivet/routes.d.ts"), "export {};\n");
    const project = {
      getCompilerOptions: () => ({ jsxImportSource: "@rivetjs/runtime" }),
      projectKind: ts.server.ProjectKind.Configured,
      getProjectName: () => join(fx.root, "tsconfig.json"),
      getRootFiles: () => [join(app, "src/page.tsx"), join(fx.root, "src/plain.tsx")],
    } as unknown as ts.server.Project;
    assert.deepEqual(fx.plugin.getExternalFiles!(project, 0 as never), [join(app, ".rivet/routes.d.ts")]);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test("language core keeps at most CHECK_CACHE_SIZE file results (least recently checked evicted)", () => {
  let compiles = 0;
  const core = createLanguageCore({
    compiler: {
      wasm: "fake",
      check: () => {
        compiles++;
        return { diagnostics: [], sites: [] };
      },
    },
  });
  const name = (i: number) => join(tmpdir(), `rivet-lru-${i}.tsx`);
  core.check(name(0), "a");
  for (let i = 1; i <= CHECK_CACHE_SIZE; i++) {
    core.check(name(i), "a");
    if (i === CHECK_CACHE_SIZE - 1) core.check(name(0), "a"); // keeps file 0 recent
  }
  assert.equal(compiles, CHECK_CACHE_SIZE + 1);
  core.check(name(0), "a");
  assert.equal(compiles, CHECK_CACHE_SIZE + 1, "recently used entry kept");
  core.check(name(1), "a");
  assert.equal(compiles, CHECK_CACHE_SIZE + 2, "least recently used entry evicted");
});
