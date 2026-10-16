import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, utimes } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { EDITOR_MANIFEST, updateEditorManifest } from "../editor.ts";
import { rivet } from "../vite.ts";

const read = async (root: string) => JSON.parse(await readFile(resolve(root, EDITOR_MANIFEST), "utf8"));

test("updateEditorManifest merges keys, rewrites only on change and else bumps the mtime", async () => {
  const root = await mkdtemp(resolve(".artifacts/editor-manifest-"));
  try {
    assert.equal(updateEditorManifest(root, { resumeModules: ["src/a.tsx"] }), true);
    assert.deepEqual(await read(root), { version: 1, resumeModules: ["src/a.tsx"] });
    // Unchanged: same text, newer mtime (rivet-check compares it with the Vite config / routes dirs).
    const past = new Date(Date.now() - 60_000);
    await utimes(resolve(root, EDITOR_MANIFEST), past, past);
    const text = await readFile(resolve(root, EDITOR_MANIFEST), "utf8");
    assert.equal(updateEditorManifest(root, { resumeModules: ["src/a.tsx"] }), false);
    assert.equal(await readFile(resolve(root, EDITOR_MANIFEST), "utf8"), text);
    assert.ok((await stat(resolve(root, EDITOR_MANIFEST))).mtimeMs > past.getTime() + 30_000);
    updateEditorManifest(root, { routesDir: "src/routes", routes: [{ id: "index", pattern: "/", file: "src/routes/index.tsx" }] });
    assert.deepEqual(await read(root), {
      version: 1,
      resumeModules: ["src/a.tsx"],
      routesDir: "src/routes",
      routes: [{ id: "index", pattern: "/", file: "src/routes/index.tsx" }],
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rivet({ resume }) records resume membership for editors; plain rivet() writes only for a config-file app", async () => {
  const root = await mkdtemp(resolve(".artifacts/editor-manifest-"));
  try {
    const configResolved = (plugin: { configResolved?: unknown }) =>
      (plugin.configResolved as (config: unknown) => void)({ root, command: "serve", build: {}, plugins: [] });
    configResolved(rivet());
    assert.equal(existsSync(resolve(root, EDITOR_MANIFEST)), false);
    // An app with a vite.config: the manifest exists once its config was evaluated (T1: rivet-check RV7101).
    (rivet().configResolved as (config: unknown) => void)({ root, command: "build", configFile: resolve(root, "vite.config.ts"), build: {}, plugins: [] });
    assert.deepEqual(await read(root), { version: 1 });
    configResolved(rivet({ resume: { modules: ["src/b.tsx", "src/a.tsx"], preload: { rules: [{ match: /Card/i, strategy: "idle" }, { match: "src/a.tsx", strategy: "eager" }] } } }));
    assert.deepEqual(await read(root), {
      version: 1,
      resumeModules: ["src/a.tsx", "src/b.tsx"],
      preloadRules: [
        { match: { regex: "Card", flags: "i" }, strategy: "idle" },
        { match: "src/a.tsx", strategy: "eager" },
      ],
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
