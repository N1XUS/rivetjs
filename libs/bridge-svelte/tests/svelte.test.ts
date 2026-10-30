import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { svelte } from "../vite.ts";

test("bridge owns SFC and rune files and composes the official plugin", () => {
  const entry = svelte({ plugin: { configFile: false, emitCss: false, compilerOptions: { css: "injected" } } });
  entry.configure?.({ root: process.cwd(), command: "build" });
  for (const file of ["Counter.svelte", "props.svelte.ts", "state.svelte.js"]) assert.ok(entry.owns(file));
  assert.ok(!entry.owns("Page.tsx"));
  assert.deepEqual(entry.dedupe, ["svelte"]);
  assert.ok(entry.plugins?.().length);
});

test("exact development pins and supported Svelte 5 peers", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.peerDependencies.svelte, ">=5.57.2 <6");
  assert.equal(pkg.devDependencies.svelte, "5.57.2");
  assert.equal(pkg.devDependencies["@sveltejs/vite-plugin-svelte"], "7.3.1");
});
