// T1 scaffold: every `@rivetjs/bridge` / `@rivetjs/bridge-react` subpath resolves, the packages stay side-effect free,
// and the adapter peer ranges equal the plan's table (docs/design/plans/2026-10-11-framework-bridges.md, Global
// Constraints; `@vitejs/plugin-react` is the Vite 8 line, see libs/bridge/CLAUDE.md "Gotchas").
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = (pkg: string) => JSON.parse(readFileSync(new URL(`../../${pkg}/package.json`, import.meta.url), "utf8"));

test("@rivetjs/bridge subpaths resolve and import", async () => {
  const core = manifest("bridge");
  assert.deepEqual(Object.keys(core.exports), [".", "./server", "./dom", "./client", "./intent", "./vite", "./adapter", "./head", "./head-client"]);
  assert.equal(core.sideEffects, false);
  assert.deepEqual(core.rivet, { source: true });
  assert.deepEqual(Object.keys(core.peerDependencies).sort(), ["@rivetjs/compiler", "@rivetjs/reactivity", "@rivetjs/runtime", "vite"]);
  for (const sub of Object.keys(core.exports)) {
    const id = "@rivetjs/bridge" + sub.slice(1);
    assert.ok(import.meta.resolve(id).includes("/libs/bridge/"), id);
    await import(id);
  }
});

test("@rivetjs/bridge-react: subpaths resolve, peers pinned to one major", async () => {
  const react = manifest("bridge-react");
  assert.equal(react.sideEffects, false);
  // The core peer follows the workspace version (bumped by `scripts/release`), the framework peers are the plan's ranges.
  assert.deepEqual(react.peerDependencies, {
    "@rivetjs/bridge": manifest("bridge").version,
    "@vitejs/plugin-react": ">=6.0.0 <7",
    react: ">=19.0.0 <20",
    "react-dom": ">=19.0.0 <20",
  });
  assert.deepEqual(react.peerDependenciesMeta, { "@vitejs/plugin-react": { optional: true } });
  // Exact pins (T6: types + the optional plugin for the dedupe build test).
  assert.deepEqual(react.devDependencies, {
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.1.2",
    react: "19.3.0",
    "react-dom": "19.3.0",
  });
  for (const sub of Object.keys(react.exports)) {
    const id = "@rivetjs/bridge-react" + sub.slice(1);
    assert.ok(import.meta.resolve(id).includes("/libs/bridge-react/"), id);
    await import(id);
  }
});

test("bridge-react NOTICE carries React's MIT notice", () => {
  const notice = readFileSync(new URL("../../bridge-react/NOTICE", import.meta.url), "utf8");
  assert.match(notice, /Copyright \(c\) Meta Platforms, Inc\. and affiliates\./);
  assert.match(notice, /MIT License/);
});

test("only the core is a Rivet source package; adapters' JSX belongs to their framework", () => {
  assert.deepEqual(manifest("bridge").rivet, { source: true });
  assert.equal(manifest("bridge-react").rivet, undefined);
});
