// T1 scaffold: the peer range is the one the spec pins, and the workspace resolves the pinned motion build.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const json = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

test("motion is a peer (>=14.1.0 <15) with the exact dev pin, and never React", () => {
  const pkg = json("../package.json");
  assert.equal(pkg.peerDependencies.motion, ">=14.1.0 <15");
  assert.equal(pkg.devDependencies.motion, "14.1.0");
  for (const field of ["dependencies", "peerDependencies", "devDependencies"])
    for (const name of Object.keys(pkg[field] ?? {})) assert.ok(!/^(react|react-dom|framer-motion)$/.test(name), `${field}: ${name}`);
});

test("the workspace resolves motion 14.1.0 with motion/mini", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  assert.equal(JSON.parse(readFileSync(require.resolve("motion/package.json"), "utf8")).version, "14.1.0");
  const mini = await import("motion/mini");
  assert.equal(typeof mini.animate, "function");
});
